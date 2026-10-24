import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { SearchablePicker } from "@/components/SearchablePicker";
import { agendaHasActivity, agendaPractitionerIds, agendaSelectedPractitioners, agendaWeekTracks } from "@/domain/agenda-selection";
import { agendaApptsQuery, agendaRefQuery } from "@/data/agenda";
import { externalBusyQuery } from "@/data/external-busy";
import { ExternalBusyBlock } from "@/features/agenda/ExternalBusyBlocks";
import { daySegments, freePlaces, hourRange, weekStart, type Segment } from "@/domain/agenda";
import type { SlotBlock, SlotException } from "@/domain/slots";
import { fmtTime } from "@/domain/slots";
import { PatientCard } from "@/features/agenda/PatientCard";
import { AgendaToolbar } from "@/features/agenda/AgendaToolbar";
import { NewAppointmentModal } from "@/features/agenda/NewAppointmentModal";
import { cn } from "@/lib/utils";
import { orgQuery } from "@/data/organisation";
import { deviceNames, deviceLite } from "@/features/organisation/devices";
import { weekdayOf, deviceCountsOn } from "@/domain/equipment";
import { AppointmentStatus } from "@/features/agenda/AppointmentActions";

const TZ = "Europe/Amsterdam";
const local = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
};
const today = () => local(new Date().toISOString()).date;
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const isoWeek = (date: string) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)); const y = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d.getTime() - y.getTime()) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7); };
const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString("nl-NL", { ...o, timeZone: "UTC" });
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const Route = createFileRoute("/_authenticated/agenda/")({
  validateSearch: z.object({
    datum: z.string().optional(), weergave: z.enum(["dag", "week"]).optional(), locatie: z.string().optional(),
    behandelaar: z.string().optional(), categorie: z.string().optional(), afspraak: z.string().optional(),
    behandelaars: z.array(z.string()).optional(),
  }),
  head: () => ({ meta: [{ title: "Agenda · Beheer · The Body Clinic" }, { name: "description", content: "Dag- en weekagenda met afspraken en beschikbaarheid van The Body Clinic." }, { property: "og:title", content: "Agenda · The Body Clinic" }, { property: "og:description", content: "Dag- en weekagenda met afspraken en beschikbaarheid van The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const HOUR = 72;

function Page() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/agenda/" });
  const [newOpen, setNewOpen] = useState(false);
  const date = s.datum ?? today();
  const week = s.weergave === "week";
  const monday = weekStart(date);
  const days = week ? Array.from({ length: 7 }, (_, i) => shift(monday, i)) : [date];
  const { data: ref } = useQuery(agendaRefQuery);
  const { data: org } = useQuery(orgQuery);
  const { data: external } = useQuery(externalBusyQuery);
  const { data: rawAppts } = useQuery(agendaApptsQuery(`${shift(monday, -1)}T00:00:00Z`, `${shift(monday, 8)}T00:00:00Z`));
  const go = (patch: Partial<typeof s>) => void navigate({ search: (p) => ({ ...p, ...patch }) });
  const practitionerIds = agendaPractitionerIds(s.behandelaars, s.behandelaar);

  const view = useMemo(() => {
    if (!ref || !rawAppts) return null;
    const locs = new Map(ref.locations.map((l) => [l.id, l]));
    const inCat = (tid: string) => !s.categorie || ref.links.some((l) => l.treatment_id === tid && (l.category_id === s.categorie || ref.categories.find((c) => c.id === l.category_id)?.parent_id === s.categorie));
    const appts = rawAppts.map((a) => ({ ...a, s: local(a.starts_at), e: local(a.ends_at) }))
      .filter((a) => !["cancelled", "no_show"].includes(a.status) && days.includes(a.s.date) && (!s.locatie || a.location_id === s.locatie) && inCat(a.treatment_id));
    const doesCat = (pid: string) => !s.categorie || ref.pracTreat.some((x) => x.practitioner_id === pid && inCat(x.treatment_id));
    const seg = (pid: string, d: string) => {
      const g = daySegments(pid, d, ref.blocks as SlotBlock[], ref.exceptions as SlotException[]);
      return s.locatie ? g.filter((x) => x.kind === "break" || x.locationId === s.locatie) : g;
    };
    type Col = { key: string; title: string; sub: string; photo?: string | null; segs: Segment[]; own: typeof appts; today?: boolean; practitionerId?: string; date?: string };
    const eligiblePeople = ref.practitioners.filter(p => doesCat(p.id) && days.some(d => agendaHasActivity(seg(p.id, d), appts.filter(a => a.practitioner_id === p.id && a.s.date === d).length)));
    let cols: Col[];
    if (week) {
      const people = agendaSelectedPractitioners(eligiblePeople, practitionerIds);
      cols = agendaWeekTracks(days, people.map(p => p.id)).map(track => {
        const p = people.find(person => person.id === track.practitionerId);
        return { ...track, title: cap(fmt(track.date, { weekday: "short" }).replace(".", "")) + " " + Number(track.date.slice(8)), sub: p ? `${p.first_name} ${p.last_name}` : '', photo: p?.photo_path ?? null, segs: seg(track.practitionerId, track.date), own: appts.filter(a => a.practitioner_id === track.practitionerId && a.s.date === track.date), today: track.date === today() };
      }).filter(c => agendaHasActivity(c.segs, c.own.length));
    } else {
      cols = agendaSelectedPractitioners(eligiblePeople, practitionerIds).map((p) => {
        const segs = seg(p.id, date);
        const where = [...new Set(segs.filter((g) => g.kind === "work").map((g) => (g.locationId && locs.get(g.locationId)?.name) || ""))].filter(Boolean);
        return { key: p.id, title: `${p.first_name} ${p.last_name}`, sub: where.join(" en "), photo: p.photo_path, segs, own: appts.filter((a) => a.practitioner_id === p.id) };
      }).filter((c) => c.segs.some((g) => g.kind === "work") || c.own.length);
      if (cols.some(c => c.segs.some(g => g.kind === "work")) && s.locatie && org) {
        const names = deviceNames(org);
        const devices = deviceLite(org).filter(d => deviceCountsOn(d, date) && (d.location_id === s.locatie || d.schedule.some(x => x.weekday === weekdayOf(date) && x.location_id === s.locatie)));
        cols.push(...org.rooms.filter(r => r.location_id === s.locatie).map(r => ({ key: `room:${r.id}`, title: r.name, sub: "Kamer", segs: [], own: appts.filter(a => a.room_id === r.id) })));
        cols.push(...devices.map(d => ({ key: `equipment:${d.id}`, title: names.get(d.id) ?? "", sub: "Apparatuur", segs: [], own: appts.filter(a => a.equipment_ids.includes(d.id)) })));
      }
    }
    const mins = cols.flatMap((c) => [...c.segs.flatMap((g) => [g.start, g.end]), ...c.own.flatMap((a) => [a.s.minute, a.e.minute])]);
    const stats = week ? {
      appts: cols.reduce((n, c) => n + c.own.length, 0),
      free: cols.reduce((n, c) => n + freePlaces(c.segs, c.own.map((a) => ({ start: a.s.minute, end: a.e.minute }))), 0),
      online: cols.reduce((n, c) => n + c.own.filter((a) => locs.get(a.location_id)?.kind === "online").length, 0),
    } : null;
    return { cols, range: hourRange(mins), locs, all: appts, stats, eligiblePeople };
  }, [ref, org, rawAppts, s.locatie, s.categorie, s.behandelaar, s.behandelaars, week, date, days.join()]);

  const label = week
    ? `Week ${isoWeek(monday)} · ${Number(monday.slice(8))} tot ${fmt(shift(monday, 6), { day: "numeric", month: "long", year: "numeric" })}`
    : cap(fmt(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const step = week ? 7 : 1;
  const [highlighted,setHighlighted]=useState<string|null>(null);
  const selected = view?.all.find((a) => a.id === s.afspraak);
  const linkedId=highlighted??s.afspraak;
  const topCats = (ref?.categories ?? []).filter((c) => !c.parent_id);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const template = `56px repeat(${Math.max(1, view?.cols.length ?? 1)}, ${week ? "minmax(110px, 1fr)" : "minmax(150px, 1fr)"})`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agenda" actions={<>
        <Link to="/agenda/rooster"><PillButton variant="outline">Rooster bewerken</PillButton></Link>
        <PillButton onClick={() => setNewOpen(true)} disabled={!ref}><img src="/ui-icons/plus.svg" alt="" className="size-4 invert" />Afspraak maken</PillButton>
      </>} />
      <AgendaToolbar value={week ? "week" : "dag"}
        onChange={(v) => v === "mijn" ? void navigate({ to: "/agenda/mijn-dag", search: { datum: s.datum, behandelaar: practitionerIds.length === 1 ? practitionerIds[0] : undefined } }) : go({ weergave: v === "week" ? "week" : undefined, afspraak: undefined })}
        dateControls={<>
          <button type="button" aria-label="Vorige" onClick={() => go({ datum: shift(date, -step), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <span className="min-w-0 text-[13px] font-semibold sm:whitespace-nowrap sm:text-[15px]">{label}</span>
          <button type="button" aria-label="Volgende" onClick={() => go({ datum: shift(date, step), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
          {!days.includes(today()) && <button type="button" onClick={() => go({ datum: undefined })} className="text-[14px] text-primary underline">Vandaag</button>}
        </>}
        filters={<>
          <div className="agenda-filters flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-2 after:order-1 after:basis-full after:content-['']">
          <SearchablePicker label="Locatie" preserveOrder selectionPlacement="below" selectionClassName="order-2" className="contents [&>label]:hidden [&>button]:w-[190px] [&>button]:max-w-full" value={s.locatie ?? "all"} onChange={values => go({ locatie: values[0] === "all" ? undefined : values[0] })}
            selectionOptions={(ref?.locations ?? []).map(l => ({ value: l.id, label: l.name }))}
            options={[{ value: "all", label: "Alle locaties" }, ...(ref?.locations ?? []).slice().sort((a,b) => Number(b.kind === 'online') - Number(a.kind === 'online')).map((l) => ({ value: l.id, label: l.name }))]} />
          <SearchablePicker label="Behandelaars" multiple selectionPlacement="below" selectionClassName={cn("order-2", s.locatie && "border-l border-mist pl-3")} className="contents [&>label]:hidden [&>button]:w-[280px] [&>button]:max-w-full" value={practitionerIds} onChange={values => go({ behandelaar: undefined, behandelaars: values.length ? values : undefined, afspraak: undefined })}
            options={(view?.eligiblePeople ?? []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}`, photoPath: p.photo_path }))}
            selectionOptions={(ref?.practitioners ?? []).map(p => ({ value: p.id, label: `${p.first_name} ${p.last_name}`, photoPath: p.photo_path }))} />
          {!week && <SearchablePicker label="Behandelingen" selectionPlacement="below" selectionClassName={cn("order-2", (s.locatie || practitionerIds.length > 0) && "border-l border-mist pl-3")} className="contents [&>label]:hidden [&>button]:w-[200px] [&>button]:max-w-full" value={s.categorie ?? "all"} onChange={values => go({ categorie: values[0] === "all" ? undefined : values[0] })}
            selectionOptions={topCats.map(c => ({ value: c.id, label: c.name_nl }))}
            options={[{ value: "all", label: "Alle behandelingen" }, ...topCats.map((c) => ({ value: c.id, label: c.name_nl }))]} />}
          </div>
        </>} />
      {!view ? <p className="text-[14px] text-muted-foreground">Laden…</p> : (
        <>
          {view.stats ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              {([["Afspraken deze week", view.stats.appts], ["Vrije plekken deze week", view.stats.free], ["Waarvan online", view.stats.online]] as const).map(([k, v]) => (
                <div key={k} className="rounded-[16px] bg-sand px-5 py-4"><p className="text-[13px] text-muted-foreground">{k}</p><p className="text-[24px] font-semibold">{v}</p></div>
              ))}
            </div>
          ) : <p className="text-[13px] text-muted-foreground">{view.cols.filter(c => !c.key.includes(":" )).length} behandelaars ingeroosterd op deze dag</p>}
          {view.cols.length > 0 && <div>
            <div ref={headRef} className="agenda-head sticky top-16 z-20 overflow-hidden bg-background lg:top-0">
            <div className="grid w-full min-w-0 pt-2" style={{ gridTemplateColumns: template }}>
              <span className="sticky left-0 z-10 bg-background" />
              {view.cols.map((c) => week
                ? <Link key={c.key} to="/agenda" search={{ datum: c.date, locatie: s.locatie, behandelaar: c.practitionerId }} aria-label={`Bekijk de dag van ${c.sub}`} className="block min-w-0 rounded-[12px] bg-background px-1.5 pb-3 text-left transition-colors hover:bg-teal-light focus-visible:outline-2 focus-visible:outline-primary"><p className={cn("truncate text-[13px]", c.today && "font-semibold text-primary")}>{c.title}</p><div className="mt-1.5 flex items-center gap-1.5"><Avatar path={c.photo ?? null} size={24} className="shrink-0" /><span className="truncate text-[11px]">{c.sub}</span></div></Link>
                : (
                  <Link key={c.key} to="/agenda/mijn-dag" disabled={c.key.includes(":")} search={{ datum: date, behandelaar: c.key }} aria-label={`Bekijk de dag van ${c.title}`} className="flex min-w-0 items-center gap-2 rounded-[12px] bg-background px-1.5 pb-3 text-left transition-colors hover:bg-teal-light focus-visible:outline-2 focus-visible:outline-primary">
                    <Avatar path={c.photo ?? null} size={28} className="shrink-0" />
                    <div className="min-w-0"><p className="truncate text-[13px] font-semibold">{c.title}</p><p className="truncate text-[11px] text-muted-foreground">{c.sub}</p></div>
                  </Link>
                ))}
            </div>
            </div>
            <div ref={bodyRef} onScroll={(e) => { if (headRef.current) headRef.current.scrollLeft = e.currentTarget.scrollLeft; }} className="overflow-x-auto overflow-y-hidden py-2">
            <div className="agenda-grid grid w-full min-w-0" style={{ gridTemplateColumns: template }}>
              <div className="sticky left-0 z-10 bg-background" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                {Array.from({ length: view.range[1] - view.range[0] + 1 }, (_, i) => <span key={i} className="absolute right-2 -translate-y-1/2 text-[12px] text-muted-foreground" style={{ top: i * HOUR }}>{fmtTime((view.range[0] + i) * 60)}</span>)}
              </div>
              {view.cols.map((c) => (
                <div key={c.key} className="relative border-l border-mist" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                  {Array.from({ length: view.range[1] - view.range[0] }, (_, i) => <span key={i} className="absolute inset-x-0 border-t border-mist/60" style={{ top: i * HOUR }} />)}
                  {c.segs.map((g, i) => <SegBox key={i} g={g} top0={view.range[0]} name={g.locationId ? view.locs.get(g.locationId)?.name ?? "" : ""} online={!!g.locationId && view.locs.get(g.locationId)?.kind === "online"} />)}
                  {external?.visible && external.periods.filter((b) => b.practitioner_id === (week ? c.practitionerId : c.key) && local(b.starts_at).date === (week ? c.date : date)).map((b) => {
                    const start = local(b.starts_at).minute, end = local(b.ends_at).minute;
                    return <ExternalBusyBlock key={b.id} start={start} end={end} top={(start - view.range[0] * 60) / 60 * HOUR} height={(end - start) / 60 * HOUR} />;
                  })}
                  {c.own.map((a) => {
                    const on = a.id === linkedId;
                    const online = view.locs.get(a.location_id)?.kind === "online";
                    const tName = ref?.treatments.find((t) => t.id === a.treatment_id)?.name_nl ?? "";
                    const categoryIds = ref?.links.filter(l => l.treatment_id === a.treatment_id).map(l => l.category_id) ?? [];
                    const category = topCats.find(c => categoryIds.includes(c.id) || ref?.categories.some(child => categoryIds.includes(child.id) && child.parent_id === c.id));
                    return (
                       <button key={a.id} type="button" onClick={() => go({ afspraak: a.id })} onMouseEnter={()=>setHighlighted(a.id)} onMouseLeave={()=>setHighlighted(null)} onFocus={()=>setHighlighted(a.id)} onBlur={()=>setHighlighted(null)} data-appointment-id={a.id} aria-pressed={on}
                         aria-label={`${fmtTime(a.s.minute)} · ${a.patient?.patient_number ?? ""} · ${tName}${online ? " · Online" : ""}`}
                         title={`${fmtTime(a.s.minute)} · ${a.patient?.patient_number ?? ""} · ${tName}${online ? " · Online" : ""}`}
                         className={cn("absolute inset-x-2 flex items-center gap-1 overflow-hidden rounded-[8px] px-2 text-left text-[11px] leading-tight", on ? "bg-primary text-primary-foreground" : a.status === "tentatief" ? "hatch" : "bg-background ring-1 ring-mist")}
                        style={{ top: ((a.s.minute - view.range[0] * 60) / 60) * HOUR + 2, height: Math.max(26, ((a.e.minute - a.s.minute) / 60) * HOUR - 4) }}>
                         <span className="shrink-0 font-semibold">{fmtTime(a.s.minute)} · {a.patient?.patient_number ?? ""}</span>
                         {!week && s.locatie && category?.icon && <img src={`/treatment-icons/${category.icon}.png`} alt={category.name_nl} className="size-3.5 shrink-0" />}
                         <span className="min-w-0 truncate">· {tName}</span>
                         {online && <img src="/ui-icons/videogesprek.svg" alt="Online" className={cn("size-3.5 shrink-0", on && "invert")} />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            </div>
          </div>}
        </>
      )}
      {selected && ref && <aside className="fixed inset-y-0 right-0 z-40 w-[420px] max-w-full overflow-y-auto bg-background shadow-[0_8px_24px_rgba(57,51,46,0.10)]"><PatientCard a={selected} treatment={ref.treatments.find((t) => t.id === selected.treatment_id)?.name_nl ?? ""} online={view?.locs.get(selected.location_id)?.kind === "online"} onClose={() => go({ afspraak: undefined })} /></aside>}
      {ref && <NewAppointmentModal open={newOpen} onOpenChange={setNewOpen} data={ref} onPickInAgenda={(p) => go({ weergave: "week", behandelaar: undefined, behandelaars: [p] })} />}
    </div>
  );
}

function SegBox({ g, top0, name, online }: { g: Segment; top0: number; name: string; online: boolean }) {
  const top = ((g.start - top0 * 60) / 60) * HOUR, h = ((g.end - g.start) / 60) * HOUR;
  return (
    <div className={cn("absolute inset-x-1 rounded-[10px]", g.kind === "break" ? "hatch" : online ? "bg-teal-light" : "bg-sand")} style={{ top, height: h }}>
      <span className="absolute bottom-1.5 right-2 max-w-[calc(100%-16px)] truncate text-[11px] text-muted-foreground">{g.kind === "break" ? "Pauze" : name}</span>
    </div>
  );
}

