import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { PlusIcon, StatusMark, TextField, TextLink, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import {
  deleteBlock, deleteException, fullName, locName, optLabel, opts, orgQuery, saveBlock, saveException, scheduleQuery, workLocationIds,
  type Org, type ScheduleBlock, type ScheduleException,
} from "@/data/organisation";
import { blockWithinOpeningHours, hhmm, isoWeekday, nextOccurrences, quarterTimes, type Recurrence } from "@/domain/organisation";
import { cn } from "@/lib/utils";

const search = z.object({ practitioner: z.string().optional(), from: z.string().optional() });

export const Route = createFileRoute("/_authenticated/agenda/rooster")({
  head: () => ({ meta: [{ title: "Rooster bewerken · Agenda · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  validateSearch: search,
  loaderDeps: ({ search: s }) => ({ practitioner: s.practitioner }),
  loader: async ({ context, deps }) => {
    const org = await context.queryClient.ensureQueryData(orgQuery);
    const pid = deps.practitioner ?? org.practitioners[0]?.id;
    if (pid) await context.queryClient.ensureQueryData(scheduleQuery(pid));
  },
  component: SchedulePage,
});

const DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"];
const START_H = 8;
const END_H = 21;
const PX_PER_H = 46;
const longDate = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const shortDate = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const dayMonth = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "long", timeZone: "UTC" });
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const iso = (d: Date) => d.toISOString().slice(0, 10);

function mondayOf(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (isoWeekday(d) - 1));
  return iso(d);
}
const addDays = (dateIso: string, n: number) => {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

function RecurIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 0 1 13.7-5.6L20 9" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 0 1-13.7 5.6L4 15" /><path d="M4 20v-5h5" />
    </svg>
  );
}
function RecurBadge({ r }: { r: string }) {
  if (r === "once") return <span className="rounded-full bg-background/80 px-1.5 text-[10px] font-semibold">1×</span>;
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <RecurIcon />{r === "biweekly" ? "2" : r === "monthly" ? "M" : ""}
    </span>
  );
}

function SchedulePage() {
  const s = Route.useSearch();
  const { data: org } = useSuspenseQuery(orgQuery);
  const pid = s.practitioner ?? org.practitioners[0]?.id ?? "";
  const { data: sched } = useSuspenseQuery(scheduleQuery(pid));
  const navigate = useNavigate({ from: Route.fullPath });
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["schedule"] });
  const today = iso(new Date());
  const weekStart = mondayOf(s.from ?? today);
  const weekEnd = addDays(weekStart, 6);
  const p = org.practitioners.find((x) => x.id === pid);
  const [blockModal, setBlockModal] = useState<ScheduleBlock | { weekday: number } | null>(null);
  const [excModal, setExcModal] = useState<ScheduleException | "new" | null>(null);
  if (!p) return <p className="text-sm text-muted-foreground">Nog geen behandelaars.</p>;

  const active = sched.blocks.filter((b) => b.valid_from <= weekEnd && (!b.valid_until || b.valid_until >= weekStart));
  const onlineIds = org.locations.filter((l) => l.kind === "online").map((l) => l.id);
  const showWeekend = active.some((b) => b.weekday >= 6);
  const days = showWeekend ? 7 : 5;
  const work = workLocationIds(org, pid);
  const clinicBlocks = active.filter((b) => !onlineIds.includes(b.location_id));
  const outside = active.filter((b) => !blockWithinOpeningHours(b, org.hours, onlineIds));
  const notWork = active.filter((b) => !work.includes(b.location_id));
  const clinicNames = [...new Set(clinicBlocks.map((b) => locName(org, b.location_id)))];
  const upcomingVacations = sched.exceptions.filter((e) => e.kind === "vacation" && e.date_to >= today);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/agenda" className="text-sm text-primary hover:text-primary-hover">Agenda</Link>
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold tracking-tight">Rooster bewerken</h1>
          <PillButton size="lg" onClick={() => toast.success("Rooster is opgeslagen")}>Opslaan</PillButton>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar path={p.photo_path} size={30} />
          <Select label="Behandelaar" value={pid} onChange={(v) => navigate({ search: { practitioner: v, from: s.from } })} options={org.practitioners.map((x) => ({ value: x.id, label: fullName(x) }))} className="w-[220px] [&>label]:sr-only" />
        </div>
        <button type="button" aria-label="Vorige week" onClick={() => navigate({ search: { practitioner: pid, from: addDays(weekStart, -7) } })} className="flex h-9 w-9 items-center justify-center rounded-full bg-sand text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>
        <span className="whitespace-nowrap text-[15px] font-semibold">Rooster vanaf {longDate.format(new Date(`${weekStart}T00:00:00Z`))}</span>
        <button type="button" aria-label="Volgende week" onClick={() => navigate({ search: { practitioner: pid, from: addDays(weekStart, 7) } })} className="flex h-9 w-9 items-center justify-center rounded-full bg-sand text-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        </button>
        <Link to="/agenda" className="ml-auto text-sm text-primary underline underline-offset-2">Bekijk de echte week in de agenda</Link>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Herhalend rooster" description="Elk blok herhaalt zich: elke week, elke 2 weken of elke maand. Het label rechtsboven in een blok laat dat zien. Een online blok kan midden in een kliniekdag staan. Klik een blok om het te wijzigen.">
            <div className="mb-4 flex flex-wrap items-center gap-4 text-[13px]">
              <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-teal-light" />Online</span>
              <span className="flex items-center gap-2"><span className="h-4 w-4 rounded bg-sand" />In de kliniek</span>
              {opts(org, "recurrence").map((o) => <span key={o.value} className="flex items-center gap-2"><RecurBadge r={o.value} />{o.label.toLowerCase()}</span>)}
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `52px repeat(${days}, minmax(0,1fr))` }}>
                <div />
                {DAYS.slice(0, days).map((d, i) => (
                  <div key={d} className="flex items-center justify-between px-2 pb-2 text-[13px]">
                    <span>{d}</span>
                    <button type="button" aria-label={`Blok toevoegen op ${d.toLowerCase()}`} onClick={() => setBlockModal({ weekday: i + 1 })} className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed border-primary text-primary"><PlusIcon /></button>
                  </div>
                ))}
                <div className="relative" style={{ height: (END_H - START_H) * PX_PER_H }}>
                  {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
                    <span key={i} className="absolute right-2 -translate-y-1/2 text-[11px] text-muted-foreground" style={{ top: i * PX_PER_H }}>{String(START_H + i).padStart(2, "0")}:00</span>
                  ))}
                </div>
                {DAYS.slice(0, days).map((d, i) => (
                  <div key={d} className="relative border-l border-line" style={{ height: (END_H - START_H) * PX_PER_H }}>
                    {Array.from({ length: END_H - START_H }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-line" style={{ top: h * PX_PER_H }} />)}
                    {active.filter((b) => b.weekday === i + 1).map((b) => {
                      const top = ((toMin(b.starts) - START_H * 60) / 60) * PX_PER_H;
                      const h = ((toMin(b.ends) - toMin(b.starts)) / 60) * PX_PER_H;
                      const isOnline = onlineIds.includes(b.location_id);
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBlockModal(b)}
                          className={cn("absolute inset-x-1 flex flex-col items-start justify-center overflow-hidden rounded-[10px] px-2 text-left", isOnline ? "bg-teal-light" : "bg-sand", "hover:ring-2 hover:ring-primary")}
                          style={{ top: top + 1, height: h - 2 }}
                        >
                          <span className="absolute right-1.5 top-1.5"><RecurBadge r={b.recurrence} /></span>
                          <span className="max-w-full truncate text-xs">{locName(org, b.location_id)}</span>
                          <span className="text-[11px] text-muted-foreground">{hhmm(b.starts)} – {hhmm(b.ends)}</span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Uitzonderingen op het rooster" description="Vakantie, een cursus of een extra dag. Een uitzondering gaat voor op het herhalende rooster.">
            <table className="w-full">
              <thead><tr className="border-b border-line"><th className={thCls}>Wanneer</th><th className={thCls}>Wat</th><th className={thCls}>Gevolg</th><th className={thCls} /></tr></thead>
              <tbody className="divide-y divide-line">
                {sched.exceptions.map((e) => (
                  <tr key={e.id}>
                    <td className={tdCls}>{whenText(e)}</td>
                    <td className={tdCls}>{whatText(org, e)}</td>
                    <td className={tdCls}>{effectText(e)}</td>
                    <td className={tdCls}><TextLink onClick={() => setExcModal(e)}>Wijzig</TextLink></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4"><PillButton variant="outline" onClick={() => setExcModal("new")}><PlusIcon />Uitzondering toevoegen</PillButton></div>
          </Card>
        </div>

        <Card title="Controle">
          <ul className="divide-y divide-line text-sm">
            <li className="flex gap-3 py-3">
              <StatusMark kind={outside.length ? "warn" : "ok"} />
              <span>{outside.length ? `${outside.length} ${outside.length === 1 ? "blok valt" : "blokken vallen"} buiten de openingstijden.` : `Alle blokken vallen binnen de openingstijden${clinicNames.length ? ` van ${clinicNames.join(", ")}` : ""}.`}</span>
            </li>
            <li className="flex gap-3 py-3">
              <StatusMark kind={notWork.length ? "warn" : "ok"} />
              <span>{notWork.length ? `${notWork.length} ${notWork.length === 1 ? "blok staat" : "blokken staan"} op een locatie waar ${p.first_name} niet werkt.` : `${p.first_name} werkt alleen op haar werklocaties.`}</span>
            </li>
            {upcomingVacations.map((v) => (
              <li key={v.id} className="flex gap-3 py-3">
                <StatusMark kind="warn" />
                <span>Vakantie {dayMonth.format(new Date(`${v.date_from}T00:00:00Z`)).split(" ")[0]} tot {dayMonth.format(new Date(`${v.date_to}T00:00:00Z`))}: afspraken in die periode volgen in de agenda.</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-[1.6] text-muted-foreground">Vrije tijden voor patiënten = dit rooster, min de afspraken, min de uitzonderingen. Bij “geen voorkeur” worden de roosters van alle behandelaars samengevoegd.</p>
        </Card>
      </div>

      {blockModal && <BlockModal org={org} practitionerId={pid} weekStart={weekStart} block={"id" in blockModal ? blockModal : null} weekday={blockModal.weekday} onClose={() => setBlockModal(null)} onSaved={refresh} />}
      {excModal && <ExceptionModal org={org} practitionerId={pid} exception={excModal === "new" ? null : excModal} onClose={() => setExcModal(null)} onSaved={refresh} />}
    </div>
  );
}

const fmt = (d: string) => shortDate.format(new Date(`${d}T00:00:00Z`)).replace(/\./g, "");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function whenText(e: ScheduleException) {
  const range = e.date_from === e.date_to ? cap(fmt(e.date_from)) : `${cap(fmt(e.date_from))} tot ${fmt(e.date_to)}`;
  return e.starts && e.ends ? `${range}, ${hhmm(e.starts)} – ${hhmm(e.ends)}` : range;
}
function whatText(org: Org, e: ScheduleException) {
  const label = optLabel(org, "schedule_exception_kind", e.kind).split(",")[0] ?? "";
  return e.location_id ? `${label}, ${locName(org, e.location_id)}` : label;
}
function effectText(e: ScheduleException) {
  const hours = e.starts && e.ends ? (toMin(e.ends) - toMin(e.starts)) / 60 : null;
  const n = (h: number) => (h === 1 ? "Eén uur" : `${["", "Eén", "Twee", "Drie", "Vier", "Vijf", "Zes", "Zeven", "Acht"][h] ?? h} uur`);
  if (e.kind === "extra_day" && hours) return `${n(hours)} extra boekbaar`;
  if (hours) return `${n(hours)} niet boekbaar`;
  return e.date_from === e.date_to ? "De hele dag niet boekbaar" : "De hele periode niet boekbaar";
}

function BlockModal({ org, practitionerId, weekStart, block, weekday, onClose, onSaved }: {
  org: Org; practitionerId: string; weekStart: string; block: ScheduleBlock | null; weekday: number; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const p = org.practitioners.find((x) => x.id === practitionerId);
  const work = workLocationIds(org, practitionerId);
  const times = quarterTimes(7, 22).map((t) => ({ value: t, label: t }));
  const [day, setDay] = useState(String(block?.weekday ?? weekday));
  const [loc, setLoc] = useState(block?.location_id ?? work[0] ?? "");
  const [from, setFrom] = useState(hhmm(block?.starts) || "09:00");
  const [to, setTo] = useState(hhmm(block?.ends) || "17:00");
  const [rec, setRec] = useState(block?.recurrence ?? "weekly");
  const [validUntil, setValidUntil] = useState(block?.valid_until ?? "");
  const validFrom = block?.valid_from ?? weekStart;
  const myTreatments = org.practitionerTreatments.filter((pt) => pt.practitioner_id === practitionerId && !pt.excluded_location_ids.includes(loc)).map((pt) => org.treatments.find((t) => t.id === pt.treatment_id)).filter((t): t is NonNullable<typeof t> => !!t);
  const [scope, setScope] = useState(block?.treatment_ids?.length === 1 ? block.treatment_ids[0] ?? "all" : "all");
  const valid = loc && from < to && (!validUntil || validUntil >= validFrom);
  const next = nextOccurrences(Number(day), rec as Recurrence, validFrom, validUntil || null, iso(new Date()) > validFrom ? iso(new Date()) : validFrom);
  const save = useMutation({
    mutationFn: () => saveBlock(block?.id ?? null, {
      practitioner_id: practitionerId, weekday: Number(day), location_id: loc, starts: from, ends: to, recurrence: rec,
      valid_from: validFrom, valid_until: validUntil || null, treatment_ids: scope === "all" ? null : [scope],
    }),
    onSuccess: async () => { await onSaved(); toast.success("Blok opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteBlock(block?.id ?? ""),
    onSuccess: async () => { await onSaved(); toast.success("Blok verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  const dayName = DAYS[Number(day) - 1] ?? "";
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={block ? "Blok wijzigen" : "Blok toevoegen"} description={`${dayName}, ${locName(org, loc)}, ${from} – ${to}`}
      footer={
        <div className="flex w-full items-center justify-between">
          {block ? <TextLink tone="warning" onClick={() => del.mutate()}>Blok verwijderen</TextLink> : <span />}
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!valid || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Dag" value={day} onChange={setDay} options={DAYS.map((d, i) => ({ value: String(i + 1), label: d }))} />
        <Select label="Locatie" value={loc} onChange={setLoc} options={work.map((l) => ({ value: l, label: locName(org, l) }))} />
        <Select label="Van" value={from} onChange={setFrom} options={times} help="Per kwartier." />
        <Select label="Tot" value={to} onChange={setTo} options={times} />
        <Select label="Herhaling" value={rec} onChange={setRec} options={opts(org, "recurrence")} help="Elke week, elke 2 weken, elke maand op deze weekdag, of eenmalig." />
        <TextField label="Geldig tot en met" type="date" value={validUntil} min={validFrom} onChange={(e) => setValidUntil(e.target.value)} help={`Vanaf ${dayMonth.format(new Date(`${validFrom}T00:00:00Z`))}. Leeg = tot nader order. Kies een einddatum als het blok tijdelijk is.`} />
        <Select label="Behandelingen in dit blok" value={scope} onChange={setScope} options={[{ value: "all", label: `Alles wat ${p?.first_name ?? ""} hier doet` }, ...myTreatments.map((t) => ({ value: t.id, label: `Alleen ${t.name_nl.toLowerCase()}` }))]} help="Beperk het als ze in dit blok alleen bepaalde behandelingen doet, bijvoorbeeld alleen consulten." className="col-span-2" />
      </div>
      {!valid && from >= to && <p className="mt-3 text-sm text-warning">De begintijd moet vóór de eindtijd liggen.</p>}
      <div className="mt-5 flex items-start gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-sm text-primary-hover">
        <RecurIcon />
        <span>
          {rec === "once" ? "Eenmalig" : `Herhaalt ${optLabel(org, "recurrence", rec).toLowerCase().replace("elke ", "elke ")} op ${dayName.toLowerCase()}`}.
          {next.length > 0 && ` Eerstvolgende ${next.length === 1 ? "keer" : "keren"}: ${next.map((d) => dayMonth.format(new Date(`${d}T00:00:00Z`))).join(", ")}.`}
        </span>
      </div>
    </Modal>
  );
}

function ExceptionModal({ org, practitionerId, exception, onClose, onSaved }: { org: Org; practitionerId: string; exception: ScheduleException | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const p = org.practitioners.find((x) => x.id === practitionerId);
  const [kind, setKind] = useState(exception?.kind ?? "vacation");
  const [prac, setPrac] = useState(practitionerId);
  const [from, setFrom] = useState(exception?.date_from ?? "");
  const [to, setTo] = useState(exception?.date_to ?? "");
  const [starts, setStarts] = useState(hhmm(exception?.starts) || "09:00");
  const [ends, setEnds] = useState(hhmm(exception?.ends) || "17:00");
  const [loc, setLoc] = useState(exception?.location_id ?? workLocationIds(org, practitionerId)[0] ?? "");
  const [existing, setExisting] = useState(exception?.existing_action ?? opts(org, "existing_appointments_action")[0]?.value ?? "");
  const [newB, setNewB] = useState(exception?.new_bookings_action ?? opts(org, "new_bookings_action")[0]?.value ?? "");
  const wholeDays = kind === "vacation" || kind === "sick";
  const singleDay = kind === "break" || kind === "other_hours" || kind === "extra_day";
  const times = quarterTimes(7, 22).map((t) => ({ value: t, label: t }));
  const end = singleDay ? from : to || from;
  const valid = from && end >= from && (wholeDays || starts < ends);
  const save = useMutation({
    mutationFn: () => saveException(exception?.id ?? null, {
      practitioner_id: prac, kind, date_from: from, date_to: end,
      starts: wholeDays ? null : starts, ends: wholeDays ? null : ends,
      location_id: kind === "extra_day" ? loc : null,
      existing_action: kind === "extra_day" ? null : existing, new_bookings_action: kind === "extra_day" ? null : newB,
    }),
    onSuccess: async () => { await onSaved(); toast.success("Uitzondering opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteException(exception?.id ?? ""),
    onSuccess: async () => { await onSaved(); toast.success("Uitzondering verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Uitzondering op het rooster" description={`${p ? fullName(p) : ""} · herhalend patroon blijft staan`}
      footer={
        <div className="flex w-full items-center justify-between">
          {exception ? <TextLink tone="warning" onClick={() => del.mutate()}>Verwijderen</TextLink> : <span />}
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!valid || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Soort" value={kind} onChange={setKind} options={opts(org, "schedule_exception_kind")} help="Of: ziek, extra dag, andere tijden op één dag, pauze." />
        <Select label="Behandelaar" value={prac} onChange={setPrac} options={org.practitioners.map((x) => ({ value: x.id, label: fullName(x) }))} />
        <TextField label={singleDay ? "Dag" : "Van"} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        {!singleDay && <TextField label="Tot en met" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}
        {!wholeDays && <Select label="Van" value={starts} onChange={setStarts} options={times} />}
        {!wholeDays && <Select label="Tot" value={ends} onChange={setEnds} options={times} />}
        {kind === "extra_day" && <Select label="Locatie" value={loc} onChange={setLoc} options={workLocationIds(org, prac).map((l) => ({ value: l, label: locName(org, l) }))} />}
      </div>
      {kind !== "extra_day" && (
        <>
          <div className="mt-5 flex gap-3 rounded-[14px] border border-signal-border bg-warning-bg px-4 py-3 text-sm">
            <StatusMark kind="warn" />
            <span><strong className="font-semibold">Afspraken in deze periode.</strong> Kies wat ermee gebeurt: verzetten naar een collega, de patiënt een nieuw moment laten kiezen (mail met link), of laten staan.</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Select label="Bestaande afspraken" value={existing} onChange={setExisting} options={opts(org, "existing_appointments_action")} />
            <Select label="Nieuwe boekingen" value={newB} onChange={setNewB} options={opts(org, "new_bookings_action")} />
          </div>
        </>
      )}
      <p className="mt-4 text-xs leading-[1.6] text-muted-foreground">Een uitzondering overschrijft het herhalende patroon alleen voor deze dagen; het patroon zelf blijft staan. Feestdagen voor alle locaties zet je in Algemeen.</p>
    </Modal>
  );
}
