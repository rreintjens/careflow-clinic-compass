import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { agendaApptsQuery, agendaRefQuery } from "@/data/agenda";
import { daySegments, freePlaces, hourRange, weekStart, type Segment } from "@/domain/agenda";
import type { SlotBlock, SlotException } from "@/domain/slots";
import { fmtTime } from "@/domain/slots";
import { PatientCard } from "@/features/agenda/PatientCard";
import { NewAppointmentModal } from "@/features/agenda/NewAppointmentModal";
import { cn } from "@/lib/utils";

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
  }),
  head: () => ({ meta: [{ title: "Agenda · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
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
  const { data: rawAppts } = useQuery(agendaApptsQuery(`${shift(days[0]!, -1)}T00:00:00Z`, `${shift(days[days.length - 1]!, 2)}T00:00:00Z`));
  const go = (patch: Partial<typeof s>) => void navigate({ search: (p) => ({ ...p, ...patch }) });
  const practitionerId = s.behandelaar ?? (week ? ref?.practitioners[0]?.id : undefined);

  const view = useMemo(() => {
    if (!ref || !rawAppts) return null;
    const locs = new Map(ref.locations.map((l) => [l.id, l]));
    const inCat = (tid: string) => !s.categorie || ref.links.some((l) => l.treatment_id === tid && (l.category_id === s.categorie || ref.categories.find((c) => c.id === l.category_id)?.parent_id === s.categorie));
    const appts = rawAppts.map((a) => ({ ...a, s: local(a.starts_at), e: local(a.ends_at) }))
      .filter((a) => days.includes(a.s.date) && (!s.locatie || a.location_id === s.locatie) && inCat(a.treatment_id));
    const doesCat = (pid: string) => !s.categorie || ref.pracTreat.some((x) => x.practitioner_id === pid && inCat(x.treatment_id));
    const seg = (pid: string, d: string) => {
      const g = daySegments(pid, d, ref.blocks as SlotBlock[], ref.exceptions as SlotException[]);
      return s.locatie ? g.filter((x) => x.kind === "break" || x.locationId === s.locatie) : g;
    };
    type Col = { key: string; title: string; sub: string; photo?: string | null; segs: Segment[]; own: typeof appts; today?: boolean };
    let cols: Col[];
    if (week) {
      const pid = practitionerId ?? "";
      cols = days.map((d) => ({ key: d, title: cap(fmt(d, { weekday: "short" }).replace(".", "")) + " " + Number(d.slice(8)), sub: "", segs: seg(pid, d), own: appts.filter((a) => a.practitioner_id === pid && a.s.date === d), today: d === today() }))
        .filter((c, i) => i < 6 || c.segs.length || c.own.length);
    } else {
      cols = ref.practitioners.filter((p) => (!s.behandelaar || p.id === s.behandelaar) && doesCat(p.id)).map((p) => {
        const segs = seg(p.id, date);
        const where = [...new Set(segs.filter((g) => g.kind === "work").map((g) => (g.locationId && locs.get(g.locationId)?.name) || ""))].filter(Boolean);
        return { key: p.id, title: `${p.first_name} ${p.last_name}`, sub: where.join(" en "), photo: p.photo_path, segs, own: appts.filter((a) => a.practitioner_id === p.id) };
      }).filter((c) => c.segs.some((g) => g.kind === "work") || c.own.length);
    }
    const mins = cols.flatMap((c) => [...c.segs.flatMap((g) => [g.start, g.end]), ...c.own.flatMap((a) => [a.s.minute, a.e.minute])]);
    const stats = week ? {
      appts: cols.reduce((n, c) => n + c.own.length, 0),
      free: cols.reduce((n, c) => n + freePlaces(c.segs, c.own.map((a) => ({ start: a.s.minute, end: a.e.minute }))), 0),
      online: cols.reduce((n, c) => n + c.own.filter((a) => locs.get(a.location_id)?.kind === "online").length, 0),
    } : null;
    return { cols, range: hourRange(mins), locs, all: appts, stats };
  }, [ref, rawAppts, s.locatie, s.categorie, s.behandelaar, week, practitionerId, date, days.join()]);

  const label = week
    ? `Week ${isoWeek(monday)} · ${Number(monday.slice(8))} tot ${fmt(shift(monday, 6), { day: "numeric", month: "long", year: "numeric" })}`
    : cap(fmt(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
  const step = week ? 7 : 1;
  const selected = view?.all.find((a) => a.id === s.afspraak);
  const topCats = (ref?.categories ?? []).filter((c) => !c.parent_id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agenda" actions={<>
        <Link to="/agenda/rooster"><PillButton variant="outline">Rooster bewerken</PillButton></Link>
        <PillButton onClick={() => setNewOpen(true)} disabled={!ref}><img src="/ui-icons/plus.svg" alt="" className="size-4 invert" />Afspraak maken</PillButton>
      </>} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Vorige" onClick={() => go({ datum: shift(date, -step), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <span className="whitespace-nowrap text-[15px] font-semibold">{label}</span>
          <button type="button" aria-label="Volgende" onClick={() => go({ datum: shift(date, step), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
          {!days.includes(today()) && <button type="button" onClick={() => go({ datum: undefined })} className="text-[14px] text-primary underline">Vandaag</button>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select label="Behandelaar" className="w-[230px] [&>label]:sr-only" value={practitionerId ?? "all"} onChange={(v) => go({ behandelaar: v === "all" ? undefined : v })}
            options={[...(week ? [] : [{ value: "all", label: "Alle behandelaars" }]), ...(ref?.practitioners ?? []).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))]} />
          <SegmentedControl label="Weergave" value={week ? "week" : "dag"} onChange={(v) => go({ weergave: v === "week" ? "week" : undefined, afspraak: undefined })} options={[{ value: "dag", label: "Dag" }, { value: "week", label: "Week" }]} />
          <Select label="Locatie" className="w-[190px] [&>label]:sr-only" value={s.locatie ?? "all"} onChange={(v) => go({ locatie: v === "all" ? undefined : v })}
            options={[{ value: "all", label: "Alle locaties" }, ...(ref?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))]} />
          {!week && <Select label="Categorie" className="w-[200px] [&>label]:sr-only" value={s.categorie ?? "all"} onChange={(v) => go({ categorie: v === "all" ? undefined : v })}
            options={[{ value: "all", label: "Alle behandelingen" }, ...topCats.map((c) => ({ value: c.id, label: c.name_nl }))]} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-6 text-[13px]">
        <Legend cls="bg-teal-light" label="Online beschikbaar" /><Legend cls="bg-sand" label="In de kliniek" /><Legend cls="hatch" label={week ? "Geblokkeerd of vrij" : "Geblokkeerd"} /><Legend cls="bg-background ring-1 ring-mist" label="Afspraak" />
      </div>
      {!view ? <p className="text-[14px] text-muted-foreground">Laden…</p> : (
        <>
          {view.stats ? (
            <div className="grid grid-cols-3 gap-4">
              {([["Afspraken deze week", view.stats.appts], ["Vrije plekken deze week", view.stats.free], ["Waarvan online", view.stats.online]] as const).map(([k, v]) => (
                <div key={k} className="rounded-[16px] bg-sand px-5 py-4"><p className="text-[13px] text-muted-foreground">{k}</p><p className="text-[24px] font-semibold">{v}</p></div>
              ))}
            </div>
          ) : <p className="text-[13px] text-muted-foreground">{view.cols.length} behandelaars ingeroosterd op deze dag</p>}
          <div className="overflow-x-auto">
            <div className="grid min-w-max" style={{ gridTemplateColumns: `56px repeat(${Math.max(1, view.cols.length)}, minmax(${week ? 160 : 260}px, 1fr))` }}>
              <span />
              {view.cols.map((c) => week
                ? <p key={c.key} className={cn("px-2 pb-3 text-[14px]", c.today && "font-semibold text-primary")}>{c.title}</p>
                : (
                  <div key={c.key} className="flex items-center gap-3 px-2 pb-3">
                    <Avatar path={c.photo ?? null} size={36} />
                    <div className="min-w-0"><p className="whitespace-nowrap text-[14px] font-semibold">{c.title}</p><p className="whitespace-nowrap text-[12px] text-muted-foreground">{c.sub}</p></div>
                  </div>
                ))}
              <div className="relative" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                {Array.from({ length: view.range[1] - view.range[0] + 1 }, (_, i) => <span key={i} className="absolute right-2 -translate-y-1/2 text-[12px] text-muted-foreground" style={{ top: i * HOUR }}>{fmtTime((view.range[0] + i) * 60)}</span>)}
              </div>
              {view.cols.map((c) => (
                <div key={c.key} className="relative border-l border-mist" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                  {Array.from({ length: view.range[1] - view.range[0] }, (_, i) => <span key={i} className="absolute inset-x-0 border-t border-mist/60" style={{ top: i * HOUR }} />)}
                  {c.segs.map((g, i) => <SegBox key={i} g={g} top0={view.range[0]} name={g.locationId ? view.locs.get(g.locationId)?.name ?? "" : ""} online={!!g.locationId && view.locs.get(g.locationId)?.kind === "online"} />)}
                  {c.own.map((a) => {
                    const on = a.id === s.afspraak;
                    const online = view.locs.get(a.location_id)?.kind === "online";
                    const tName = ref?.treatments.find((t) => t.id === a.treatment_id)?.name_nl ?? "";
                    return (
                      <button key={a.id} type="button" onClick={() => go({ afspraak: a.id })}
                        className={cn("absolute inset-x-2 overflow-hidden rounded-[8px] px-2.5 py-1 text-left", on ? "bg-primary text-primary-foreground" : "bg-background ring-1 ring-mist")}
                        style={{ top: ((a.s.minute - view.range[0] * 60) / 60) * HOUR + 2, height: Math.max(26, ((a.e.minute - a.s.minute) / 60) * HOUR - 4) }}>
                        <p className="whitespace-nowrap text-[12px] font-semibold">{fmtTime(a.s.minute)} · {a.patient?.patient_number ?? ""}{online && <span className={on ? "" : "text-primary"}> · Online</span>}</p>
                        {!week && <p className="truncate text-[11px]">{tName}</p>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {selected && ref && <aside className="fixed inset-y-0 right-0 z-30 w-[420px] overflow-y-auto bg-background shadow-[0_8px_24px_rgba(57,51,46,0.10)]"><PatientCard a={selected} treatment={ref.treatments.find((t) => t.id === selected.treatment_id)?.name_nl ?? ""} online={view?.locs.get(selected.location_id)?.kind === "online"} onClose={() => go({ afspraak: undefined })} /></aside>}
      {ref && <NewAppointmentModal open={newOpen} onOpenChange={setNewOpen} data={ref} onPickInAgenda={(p) => go({ weergave: "week", behandelaar: p })} />}
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return <span className="flex items-center gap-2 whitespace-nowrap"><span className={cn("size-4 rounded-[4px]", cls)} />{label}</span>;
}

function SegBox({ g, top0, name, online }: { g: Segment; top0: number; name: string; online: boolean }) {
  const top = ((g.start - top0 * 60) / 60) * HOUR, h = ((g.end - g.start) / 60) * HOUR;
  return (
    <div className={cn("absolute inset-x-1 rounded-[10px]", g.kind === "break" ? "hatch" : online ? "bg-teal-light" : "bg-sand")} style={{ top, height: h }}>
      <span className="absolute bottom-1.5 right-2.5 text-[11px] text-muted-foreground">{g.kind === "break" ? "Pauze" : name}</span>
    </div>
  );
}

