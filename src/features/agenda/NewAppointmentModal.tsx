import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { patientSearchQuery, type AgendaRef } from "@/data/agenda";
import type { Dossier } from "@/data/patients";
import { createStaffAppointment, createStaffPatient, getStaffSlots } from "@/data/agenda.functions";
import { TextField } from "@/components/Field";
import { DobField } from "@/features/questionnaire/QuestionnaireRunner";
import { fmtTime } from "@/domain/slots";
import { cn } from "@/lib/utils";

type Ref = AgendaRef;
type Hit = { id: string; patient_number: number | null; first_name: string; last_name: string; date_of_birth: string | null; email?: string | null };
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
const dobT = (k: string, e?: Record<string, string | number>) => (k === "dd" ? "dd" : k === "mm" ? "mm" : k === "yyyy" ? "jjjj" : k === "age_shown" ? `${e?.["age"]} jaar` : k);

/** First name, last name, date of birth, e-mail, phone; offers an existing patient when it looks like a duplicate. */
function NewPatientForm({ initial, onDone, onCancel }: { initial: string; onDone: (p: Hit) => void; onCancel: () => void }) {
  const createFn = useServerFn(createStaffPatient);
  const words = /^\d+$/.test(initial.trim()) || initial.includes("@") ? [] : initial.trim().split(/\s+/);
  const [f, setF] = useState({ firstName: words[0] ?? "", lastName: words.slice(1).join(" "), dateOfBirth: "", email: initial.includes("@") ? initial.trim() : "", phone: "" });
  const [dups, setDups] = useState<{ list: Hit[]; emailTaken: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ok = f.firstName.trim() && f.lastName.trim() && f.dateOfBirth && /^\S+@\S+\.\S+$/.test(f.email);
  const save = async (force: boolean) => {
    setBusy(true); setErr(null);
    try {
      const r = await createFn({ data: { ...f, force } });
      if (r.ok) onDone(r.patient);
      else if ("failed" in r && r.failed) setErr("Aanmaken is niet gelukt.");
      else setDups({ list: r.duplicates, emailTaken: r.emailTaken });
    } catch { setErr("Aanmaken is niet gelukt."); }
    setBusy(false);
  };
  return (
    <div className="flex flex-col gap-3 rounded-[16px] bg-background p-4 ring-1 ring-mist">
      <p className="text-[14px] font-semibold">Nieuwe patiënt</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Voornaam" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} />
        <TextField label="Achternaam" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} />
      </div>
      <div><p className="mb-2 text-[13px] font-medium">Geboortedatum</p><DobField value={f.dateOfBirth} onChange={(v) => setF({ ...f, dateOfBirth: v })} t={dobT} today={today()} /></div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <TextField label="Telefoon" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      </div>
      {dups && (
        <div role="alert" className="flex flex-col gap-2 rounded-[14px] bg-signal p-3 ring-1 ring-signal-border">
          <p className="text-[13px]">{dups.emailTaken ? "Er is al een patiënt met dit e-mailadres. Kies die patiënt:" : "Deze patiënt bestaat misschien al. Bedoel je:"}</p>
          {dups.list.map((p) => (
            <button key={p.id} type="button" onClick={() => onDone(p)} className="flex items-center justify-between rounded-[12px] bg-background px-3 py-2 text-left text-[13px] ring-1 ring-mist">
              <span>{p.first_name} {p.last_name} · {p.patient_number} · {dmy(p.date_of_birth)}{p.email ? ` · ${p.email}` : ""}</span><span className="text-primary">Deze patiënt kiezen</span>
            </button>
          ))}
          {!dups.emailTaken && <button type="button" className="self-start text-[13px] text-primary underline" onClick={() => void save(true)}>Nee, toch een nieuwe patiënt aanmaken</button>}
        </div>
      )}
      {err && <p className="text-[13px] text-warning">{err}</p>}
      <div className="flex gap-2">
        <PillButton size="sm" disabled={!ok || busy} onClick={() => void save(false)}>Patiënt aanmaken en verder</PillButton>
        <PillButton size="sm" variant="outline" onClick={onCancel}>Annuleren</PillButton>
      </div>
    </div>
  );
}
const initials = (a: string, b: string) => `${a.charAt(0)}${b.charAt(0)}`.toUpperCase();
const dmy = (d: string | null) => (d ? d.split("-").reverse().join("-") : "");

/** "Afspraak maken" from the agenda: choose patient, treatment, way, practitioner, location and a free moment. */
export function NewAppointmentModal({ open, onOpenChange, data, onPickInAgenda, fixedPatient }: { open: boolean; onOpenChange: (o: boolean) => void; data: Ref; onPickInAgenda: (practitionerId: string) => void; fixedPatient?: NonNullable<Dossier["patient"]> }) {
  const qc = useQueryClient();
  const slotsFn = useServerFn(getStaffSlots);
  const create = useServerFn(createStaffAppointment);
  const [q, setQ] = useState("");
  const [patient, setPatient] = useState<string | null>(fixedPatient?.id ?? null);
  const [treatment, setTreatment] = useState("");
  const [how, setHow] = useState<"online" | "clinic">("online");
  const [prac, setPrac] = useState("");
  const [loc, setLoc] = useState("");
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  const [notify, setNotify] = useState("as_usual");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<Hit | null>(null);
  const { data: hits = [] } = useQuery({ ...patientSearchQuery(q), enabled: !fixedPatient && q.trim().length >= 2 });

  const locKind = (id: string) => data.locations.find((l) => l.id === id)?.kind;
  const treatLocs = useMemo(() => new Set(data.treatLoc.filter((x) => x.treatment_id === treatment).map((x) => x.location_id)), [data, treatment]);
  const hasOnline = data.locations.some((l) => l.kind === "online" && treatLocs.has(l.id));
  const hasClinic = data.locations.some((l) => l.kind !== "online" && treatLocs.has(l.id));
  const locOptions = data.locations.filter((l) => treatLocs.has(l.id) && (how === "online" ? l.kind === "online" : l.kind !== "online"));
  const pracOptions = data.practitioners.filter((p) => data.pracTreat.some((x) => x.practitioner_id === p.id && x.treatment_id === treatment && !(x.excluded_location_ids ?? []).includes(loc))
    && (data.pracLoc.some((x) => x.practitioner_id === p.id && x.location_id === loc)
      || (locKind(loc) === "online" && data.blocks.some((b) => b.practitioner_id === p.id && locKind(b.location_id) === "clinic" && b.allows_online && (!b.treatment_ids?.length || b.treatment_ids.includes(treatment))))));

  useEffect(() => { if (how === "online" && !hasOnline && hasClinic) setHow("clinic"); if (how === "clinic" && !hasClinic && hasOnline) setHow("online"); }, [hasOnline, hasClinic, how]);
  useEffect(() => { if (!locOptions.some((l) => l.id === loc)) setLoc(locOptions[0]?.id ?? ""); }, [locOptions, loc]);
  useEffect(() => { if (!pracOptions.some((p) => p.id === prac)) setPrac(pracOptions[0]?.id ?? ""); }, [pracOptions, prac]);
  const { data: slots = [], isFetching } = useQuery({
    queryKey: ["staff-slots", treatment, loc, prac], enabled: !!(treatment && loc && prac),
    queryFn: () => slotsFn({ data: { treatmentId: treatment, locationId: loc, practitionerId: prac } }),
  });
  useEffect(() => setSlot(slots[0] ?? null), [slots]);

  const reset = () => { setAdding(false); setCreated(null); setQ(""); setPatient(fixedPatient?.id ?? null); setTreatment(""); setSlot(null); setReason(""); setError(null); };
  const submit = async () => {
    if (!patient || !treatment || !loc || !prac || !slot) { setError("Kies een patiënt, behandeling, behandelaar en moment."); return; }
    setBusy(true);
    const r = await create({ data: { patientId: patient, treatmentId: treatment, locationId: loc, practitionerId: prac, date: slot.date, start: slot.start, notify, reason: reason || null } });
    setBusy(false);
    if (!r.ok) { setError(r.reason === "taken" ? "Dit moment is net bezet. Kies een ander moment." : "Inplannen is niet gelukt."); void qc.invalidateQueries({ queryKey: ["staff-slots"] }); return; }
    await Promise.all([qc.invalidateQueries({ queryKey: ["agenda-appts"] }), qc.invalidateQueries({ queryKey: ["dossier"] }), qc.invalidateQueries({ queryKey: ["patient-list"] })]);
    reset();
    onOpenChange(false);
  };
  const chip = (d: string, m: number) => {
    const x = new Date(`${d}T12:00:00Z`);
    const wd = x.toLocaleDateString("nl-NL", { weekday: "short", timeZone: "UTC" }).replace(".", "");
    return `${wd.charAt(0).toUpperCase()}${wd.slice(1)} ${x.getUTCDate()} ${x.toLocaleDateString("nl-NL", { month: "short", timeZone: "UTC" }).replace(".", "")} ${fmtTime(m)}`;
  };
  const opt = (k: string) => data.options.filter((o) => o.list_key === k).map((o) => ({ value: o.value, label: o.label_nl }));
  const chosen = hits.find((h) => h.id === patient) ?? (created?.id === patient ? created : undefined);
  const pick = (p: Hit) => { setCreated(p); setPatient(p.id); setAdding(false); };

  return (
    <Modal open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }} title={fixedPatient ? "Afspraak inplannen" : "Afspraak maken"} width="lg"
      footer={<><PillButton variant="outline" onClick={() => onOpenChange(false)}>Annuleren</PillButton><PillButton onClick={() => void submit()} disabled={busy}>Afspraak inplannen</PillButton></>}>
      <div className="flex flex-col gap-5">
        {fixedPatient ? <p className="text-[14px] font-medium">{fixedPatient.first_name} {fixedPatient.last_name} · {fixedPatient.patient_number}</p> : <div className="flex flex-col gap-2">
          <label htmlFor="who" className="text-[13px] font-medium">Voor wie</label>
          <div className="flex h-11 items-center gap-3 rounded-full bg-sand px-4">
            <img src="/ui-icons/zoeken.svg" alt="" className="size-4" />
            <input id="who" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam, patiëntnummer of e-mail" className="h-full flex-1 bg-transparent text-[14px] outline-none" />
          </div>
          {adding ? <NewPatientForm initial={q} onDone={pick} onCancel={() => setAdding(false)} /> : !chosen && <button type="button" onClick={() => setAdding(true)} className="self-start text-[13px] text-primary underline">Nieuwe patiënt</button>}
          {!adding && (chosen ? [chosen, ...hits.filter((h) => h.id !== chosen.id)] : hits).map((h) => (
            <button key={h.id} type="button" onClick={() => setPatient(h.id)} className={cn("flex items-center gap-3 rounded-[14px] px-4 py-2.5 text-left ring-1", patient === h.id ? "bg-teal-light ring-primary" : "bg-background ring-mist")}>
              <span className="flex size-8 items-center justify-center rounded-full bg-sand text-[11px] font-semibold">{initials(h.first_name, h.last_name)}</span>
              <span className="flex-1"><span className="block text-[14px]">{h.first_name} {h.last_name}</span><span className="block text-[12px] text-muted-foreground">{h.patient_number} · {dmy(h.date_of_birth)}</span></span>
              {patient === h.id && <span className="text-[12px] text-primary">Gekozen</span>}
            </button>
          ))}
        </div>}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Behandeling" value={treatment} onChange={setTreatment} options={data.treatments.map((t) => ({ value: t.id, label: `${t.name_nl}, ${t.duration_min} min` }))} />
          <Select label="Hoe" value={how} onChange={(v) => setHow(v as "online" | "clinic")} disabled={!treatment}
            options={[...(hasOnline || !treatment ? [{ value: "online", label: "Online via Google Meet" }] : []), ...(hasClinic ? [{ value: "clinic", label: "In de kliniek" }] : [])]} />
          <Select label="Behandelaar" value={prac} onChange={setPrac} disabled={!pracOptions.length} options={pracOptions.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))} />
          <Select label="Locatie" value={loc} onChange={setLoc} disabled={how === "online" || !locOptions.length}
            options={locOptions.map((l) => ({ value: l.id, label: locKind(l.id) === "online" ? "Niet van toepassing, online" : l.name }))} />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-medium">Eerstvolgende momenten</p>
          <div className="flex flex-wrap gap-2">
            {isFetching && <span className="text-[13px] text-muted-foreground">Zoeken…</span>}
            {!isFetching && treatment && !slots.length && <span className="text-[13px] text-muted-foreground">Geen vrije momenten in de komende 4 weken.</span>}
            {slots.map((x) => {
              const on = slot?.date === x.date && slot.start === x.start;
              return <button key={`${x.date}${x.start}`} type="button" onClick={() => setSlot(x)} className={cn("h-10 whitespace-nowrap rounded-full px-4 text-[14px]", on ? "bg-teal-light ring-1 ring-primary" : "bg-sand")}>{chip(x.date, x.start)}</button>;
            })}
            {prac && <button type="button" onClick={() => { onOpenChange(false); onPickInAgenda(prac); }} className="h-10 whitespace-nowrap rounded-full bg-sand px-4 text-[14px]">Kies in de agenda</button>}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Bevestiging en herinnering" value={notify} onChange={setNotify} options={opt("agenda_notify")} />
          <Select label="Reden" value={reason} onChange={setReason} options={opt("agenda_reason")} />
        </div>
        {error && <p className="rounded-[12px] bg-warning-bg px-4 py-3 text-[13px] text-warning">{error}</p>}
        <p className="text-[12px] text-muted-foreground">De afspraak krijgt een Meet-link via het gekoppelde account en komt op de tijdlijn van de patiënt.</p>
      </div>
    </Modal>
  );
}
