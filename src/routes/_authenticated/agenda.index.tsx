import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { agendaQuery } from "@/data/agenda";
import { daySegments, hourRange, type Segment } from "@/domain/agenda";
import type { SlotBlock, SlotException } from "@/domain/slots";
import { fmtTime } from "@/domain/slots";
import { cn } from "@/lib/utils";

const TZ = "Europe/Amsterdam";
const local = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
};
const today = () => local(new Date().toISOString()).date;
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const ageOf = (dob: string, on: string) => { const [y, m, d] = dob.split("-").map(Number) as [number, number, number]; const [Y, M, D] = on.split("-").map(Number) as [number, number, number]; return Y - y - (M < m || (M === m && D < d) ? 1 : 0); };

export const Route = createFileRoute("/_authenticated/agenda/")({
  validateSearch: z.object({ datum: z.string().optional(), locatie: z.string().optional(), afspraak: z.string().optional() }),
  head: () => ({ meta: [{ title: "Agenda · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const HOUR = 72; // px per hour, as in the design

function Page() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/agenda/" });
  const date = s.datum ?? today();
  const { data } = useQuery(agendaQuery(date, `${shift(date, -1)}T00:00:00Z`, `${shift(date, 2)}T00:00:00Z`));
  const go = (patch: Partial<typeof s>) => void navigate({ search: (p) => ({ ...p, ...patch }) });

  const view = useMemo(() => {
    if (!data) return null;
    const locKind = new Map(data.locations.map((l) => [l.id, l]));
    const appts = data.appointments.map((a) => ({ ...a, s: local(a.starts_at), e: local(a.ends_at) })).filter((a) => a.s.date === date)
      .filter((a) => !s.locatie || a.location_id === s.locatie);
    const cols = data.practitioners.map((p) => {
      let segs = daySegments(p.id, date, data.blocks as SlotBlock[], data.exceptions as SlotException[]);
      if (s.locatie) segs = segs.filter((g) => g.kind === "break" || g.locationId === s.locatie);
      const own = appts.filter((a) => a.practitioner_id === p.id);
      const where = [...new Set(segs.filter((g) => g.kind === "work").map((g) => g.locationId && locKind.get(g.locationId)?.name).filter(Boolean))];
      return { p, segs, own, where };
    }).filter((c) => c.segs.some((g) => g.kind === "work") || c.own.length).sort((a, b) => a.p.first_name.localeCompare(b.p.first_name, "nl"));
    const mins = cols.flatMap((c) => [...c.segs.flatMap((g) => [g.start, g.end]), ...c.own.flatMap((a) => [a.s.minute, a.e.minute])]);
    return { cols, range: hourRange(mins), locKind, all: appts };
  }, [data, date, s.locatie]);

  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const selected = view?.all.find((a) => a.id === s.afspraak);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Agenda" actions={<><Link to="/agenda/rooster"><PillButton variant="secondary">Rooster bewerken</PillButton></Link></>} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Vorige dag" onClick={() => go({ datum: shift(date, -1), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <span className="whitespace-nowrap text-[15px] font-semibold">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
          <button type="button" aria-label="Volgende dag" onClick={() => go({ datum: shift(date, 1), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
          {date !== today() && <button type="button" onClick={() => go({ datum: undefined })} className="text-[14px] text-primary underline">Vandaag</button>}
        </div>
        <Select label="Locatie" className="w-[220px] [&>label]:sr-only" value={s.locatie ?? "all"} onChange={(v) => go({ locatie: v === "all" ? undefined : v })}
          options={[{ value: "all", label: "Alle locaties" }, ...(data?.locations ?? []).map((l) => ({ value: l.id, label: l.name }))]} />
      </div>
      <div className="flex flex-wrap gap-6 text-[13px]">
        <Legend cls="bg-teal-light" label="Online beschikbaar" /><Legend cls="bg-sand" label="In de kliniek" /><Legend cls="hatch" label="Geblokkeerd" /><Legend cls="bg-background ring-1 ring-mist" label="Afspraak" />
      </div>
      {!view ? <p className="text-[14px] text-muted-foreground">Laden…</p> : (
        <>
          <p className="text-[13px] text-muted-foreground">{view.cols.length} behandelaars ingeroosterd op deze dag</p>
          <div className="overflow-x-auto">
            <div className="grid min-w-max" style={{ gridTemplateColumns: `56px repeat(${view.cols.length}, minmax(260px, 1fr))` }}>
              <span />
              {view.cols.map((c) => (
                <div key={c.p.id} className="flex items-center gap-3 px-2 pb-3">
                  <Avatar path={c.p.photo_path} size={36} />
                  <div className="min-w-0"><p className="whitespace-nowrap text-[14px] font-semibold">{c.p.first_name} {c.p.last_name}</p><p className="whitespace-nowrap text-[12px] text-muted-foreground">{c.where.join(" en ")}</p></div>
                </div>
              ))}
              <div className="relative" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                {Array.from({ length: view.range[1] - view.range[0] + 1 }, (_, i) => <span key={i} className="absolute right-2 -translate-y-1/2 text-[12px] text-muted-foreground" style={{ top: i * HOUR }}>{fmtTime((view.range[0] + i) * 60)}</span>)}
              </div>
              {view.cols.map((c) => (
                <div key={c.p.id} className="relative border-l border-mist" style={{ height: (view.range[1] - view.range[0]) * HOUR }}>
                  {Array.from({ length: view.range[1] - view.range[0] }, (_, i) => <span key={i} className="absolute inset-x-0 border-t border-mist/60" style={{ top: i * HOUR }} />)}
                  {c.segs.map((g, i) => <SegBox key={i} g={g} top0={view.range[0]} name={g.locationId ? view.locKind.get(g.locationId)?.name ?? "" : ""} online={!!g.locationId && view.locKind.get(g.locationId)?.kind === "online"} />)}
                  {c.own.map((a) => {
                    const on = a.id === s.afspraak;
                    const online = view.locKind.get(a.location_id)?.kind === "online";
                    const tName = data?.treatments.find((t) => t.id === a.treatment_id)?.name_nl ?? "";
                    return (
                      <button key={a.id} type="button" onClick={() => go({ afspraak: a.id })}
                        className={cn("absolute inset-x-2 overflow-hidden rounded-[8px] px-2.5 py-1 text-left", on ? "bg-primary text-primary-foreground" : "bg-background ring-1 ring-mist")}
                        style={{ top: ((a.s.minute - view.range[0] * 60) / 60) * HOUR + 2, height: Math.max(30, ((a.e.minute - a.s.minute) / 60) * HOUR - 4) }}>
                        <p className="whitespace-nowrap text-[12px] font-semibold">{a.s.minute >= 0 && fmtTime(a.s.minute)} · {a.patient?.patient_number ?? ""}{online && <span className={on ? "" : "text-primary"}> · Online</span>}</p>
                        <p className="truncate text-[11px]">{tName}</p>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      {selected && data && <AppointmentPanel a={selected} date={date} treatment={data.treatments.find((t) => t.id === selected.treatment_id)?.name_nl ?? ""} online={view?.locKind.get(selected.location_id)?.kind === "online"} onClose={() => go({ afspraak: undefined })} />}
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

type Appt = NonNullable<ReturnType<typeof useQuery<Awaited<ReturnType<NonNullable<ReturnType<typeof agendaQuery>["queryFn"]>>>>>["data"]>["appointments"][number] & { s: { minute: number }; e: { minute: number } };

/** The single patient card (short form); the full record opens via "Open dossier". */
function AppointmentPanel({ a, date, treatment, online, onClose }: { a: Appt; date: string; treatment: string; online: boolean; onClose: () => void }) {
  const p = a.patient;
  const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const facts: Array<[string, string]> = [
    ["Telefoon", p?.phone ?? ""],
    ["Geboekt via", a.referral_source ?? a.source ?? ""],
  ];
  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-[420px] flex-col gap-5 overflow-y-auto bg-background p-6 shadow-[0_8px_24px_rgba(57,51,46,0.10)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] text-muted-foreground">{day.charAt(0).toUpperCase() + day.slice(1)} · {fmtTime(a.s.minute)} tot {fmtTime(a.e.minute)}{online ? " · online" : ""}</p>
          <h2 className="mt-1 text-[22px] font-semibold">{p ? `${p.first_name} ${p.last_name}` : ""}</h2>
          <p className="text-[13px] text-muted-foreground">{[p?.patient_number, p?.date_of_birth ? `${ageOf(p.date_of_birth, date)} jaar` : null, `${a.new_patient ? "eerste " : ""}${treatment.toLowerCase()}`].filter(Boolean).join(" · ")}</p>
        </div>
        <button type="button" aria-label="Sluiten" onClick={onClose} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/kruis.svg" alt="" className="size-4" /></button>
      </div>
      <Link to="/patienten"><PillButton size="lg" className="w-full">Open dossier</PillButton></Link>
      {online && (
        <div className="flex items-center gap-4 rounded-[14px] bg-sand p-4">
          {a.meet_link
            ? <a href={a.meet_link} target="_blank" rel="noreferrer"><PillButton variant="secondary"><img src="/ui-icons/videogesprek.svg" alt="" className="size-4" />Start Google Meet</PillButton></a>
            : <PillButton variant="secondary" disabled><img src="/ui-icons/videogesprek.svg" alt="" className="size-4" />Start Google Meet</PillButton>}
          <p className="text-[12px] text-muted-foreground">Dezelfde link als in je Google Agenda en in de mail van de patiënt.</p>
        </div>
      )}
      <dl className="flex flex-col">
        {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-mist py-2.5 text-[13px]"><dt className="text-muted-foreground">{k}</dt><dd className="whitespace-nowrap">{v}</dd></div>)}
      </dl>
      <p className="text-[12px] text-muted-foreground">Deze kaart is overal hetzelfde: in de agenda, in Mijn dag en in de patiëntenlijst. Het volledige dossier open je met de knop bovenaan.</p>
    </aside>
  );
}
