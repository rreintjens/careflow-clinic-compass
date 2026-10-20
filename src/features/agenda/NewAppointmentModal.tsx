import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { patientSearchQuery, type AgendaAppt, type AgendaRef } from "@/data/agenda";
import type { Dossier } from "@/data/patients";
import { createStaffAppointment, createStaffPatient, getStaffSlots, getStaffPreparation } from "@/data/agenda.functions";
import { TextField, Checkbox, TextArea } from "@/components/Field";
import { orgQuery } from "@/data/organisation";
import { appointmentStatusOptionsQuery } from "@/data/reception";
import { supabase } from "@/integrations/supabase/client";
import { DobField } from "@/features/questionnaire/QuestionnaireRunner";
import { fmtTime } from "@/domain/slots";
import { cn } from "@/lib/utils";
import {notificationPlanSchema} from "@/domain/appointment-notifications";

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
export function NewAppointmentModal({ open, onOpenChange, data, onPickInAgenda, fixedPatient, appointment, waitlist }: { open: boolean; onOpenChange: (o: boolean) => void; data: Ref; onPickInAgenda: (practitionerId: string) => void; fixedPatient?: NonNullable<Dossier["patient"]>; appointment?: AgendaAppt; waitlist?: {id:string;patientId:string;treatmentId:string|null;name:string} }) {
  const qc = useQueryClient();
  const slotsFn = useServerFn(getStaffSlots);
  const create = useServerFn(createStaffAppointment);
  const preparationFn=useServerFn(getStaffPreparation);
  const [q, setQ] = useState("");
  const [patient, setPatient] = useState<string | null>(fixedPatient?.id ?? appointment?.patient?.id ?? waitlist?.patientId ?? null);
  const [treatment, setTreatment] = useState(appointment?.treatment_id ?? waitlist?.treatmentId ?? "");
  const [how, setHow] = useState<"online" | "clinic">(appointment && data.locations.find(l=>l.id===appointment.location_id)?.kind!=="online" ? "clinic":"online");
  const [prac, setPrac] = useState(appointment?.practitioner_id ?? "");
  const [loc, setLoc] = useState(appointment?.location_id ?? "");
  const [slot, setSlot] = useState<{ date: string; start: number } | null>(null);
  const [notify, setNotify] = useState(appointment?.notify ?? "as_usual");
  const [notificationPlan,setNotificationPlan]=useState<Record<string,{email:boolean;sms:boolean}>>(()=>{const parsed=notificationPlanSchema.safeParse(appointment?.notification_plan);return parsed.success?parsed.data:{};});
  const moments=data.options.filter(o=>o.list_key==="mail_moment" && ["confirmation","appointment_reminder","questionnaire_reminder","details_reminder","rescheduled","cancelled","no_show"].includes(o.value)).map(o=>({value:o.value,label:o.label_nl}));
  const [reason, setReason] = useState(appointment?.booking_reason ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [created, setCreated] = useState<Hit | null>(null);
  const [kind, setKind] = useState(appointment?.kind ?? "");
  const [tentative, setTentative] = useState(appointment?.status==="tentatief");
  const [room, setRoom] = useState(appointment?.room_id ?? "");
  const [double, setDouble] = useState(false);
  const [doubleReason, setDoubleReason] = useState("");
  const [manualDate, setManualDate] = useState(today());
  const [manualTime, setManualTime] = useState("");
  const {data:canDouble=false}=useQuery({queryKey:["can-double-book"],queryFn:async()=>!!(await supabase.rpc("has_permission",{_perm:"agenda.double_book"})).data});
  const { data: org } = useQuery(orgQuery);
  const { data: appointmentOptions = [] } = useQuery(appointmentStatusOptionsQuery);
  const { data: history } = useQuery({ queryKey: ["booking-patient-history",patient], enabled: !!patient && open, queryFn: async () => {
    if(!patient) return null;
    const [p,a] = await Promise.all([supabase.from("patients").select("labels,online_booking_blocked").eq("id",patient).single(),supabase.from("appointments").select("starts_at,status,treatment:treatments(name_nl)").eq("patient_id",patient).order("starts_at",{ascending:false}).limit(3)]);
    if(p.error || a.error) throw p.error ?? a.error;
    return {patient:p.data,appointments:a.data};
  }});
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
    queryKey: ["staff-slots", treatment, loc, prac,appointment?.id], enabled: !!(treatment && loc && prac),
    queryFn: () => slotsFn({ data: { treatmentId: treatment, locationId: loc, practitionerId: prac,appointmentId:appointment?.id } }),
  });
  useEffect(() => setSlot(slots[0] ?? null), [slots]);
  const {data:preparation}=useQuery({queryKey:["appointment-preparation",patient,treatment,slot?.date,appointment?.id],enabled:!!patient&&!!treatment&&!!slot,queryFn:()=>{if(!patient||!slot)throw new Error("Kies eerst een patiënt en moment.");return preparationFn({data:{patientId:patient,treatmentId:treatment,at:`${slot.date}T12:00:00Z`,appointmentId:appointment?.id}});}});

  const reset = () => { setAdding(false); setCreated(null); setQ(""); setPatient(fixedPatient?.id ?? null); setTreatment(""); setSlot(null); setReason(""); setError(null); setKind(""); setTentative(false); setRoom(""); setDouble(false); setDoubleReason(""); setManualTime(""); };
  const submit = async () => {
    const moment = double ? (/^\d{2}:\d{2}$/.test(manualTime) ? {date:manualDate,start:Number(manualTime.slice(0,2))*60+Number(manualTime.slice(3))} : null) : slot;
    if (!patient || !treatment || !loc || !prac || !moment || (double && doubleReason.trim().length<3)) { setError("Kies een patiënt, behandeling, behandelaar en moment; geef bij dubbel boeken een reden."); return; }
    setBusy(true);
    const r = await create({ data: { patientId: patient, treatmentId: treatment, locationId: loc, practitionerId: prac, date: moment.date, start: moment.start, notify, reason: reason || null, kind:kind||undefined, tentative,roomId:how==="clinic"?room||undefined:undefined,doubleBookReason:double?doubleReason:undefined,appointmentId:appointment?.id,expectedStartsAt:appointment?.starts_at,waitlistId:waitlist?.id,notificationPlan } });
    setBusy(false);
    if (!r.ok) { setError(r.reason === "resources" ? "Er is geen vrije geschikte kamer of apparatuur op dit moment." : r.reason === "forbidden" ? "Inplannen is niet toegestaan voor deze patiënt of medewerker." : r.reason === "external_busy" ? "Deze behandelaar is op dit moment bezet in eKis. Kies een ander moment." : r.reason === "taken" ? "Dit moment is bezet, mogelijk in eKis. Kies een ander moment." : "Inplannen is niet gelukt."); void qc.invalidateQueries({ queryKey: ["staff-slots"] }); return; }
    await Promise.all(["agenda-appts","dossier","patient-list","reception-tasks","waitlist","staff-slots"].map(key=>qc.invalidateQueries({queryKey:[key]})));
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
    <Modal open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }} title={appointment?"Afspraak verzetten":fixedPatient ? "Afspraak inplannen" : "Afspraak maken"} width="lg"
      footer={<><PillButton variant="outline" onClick={() => onOpenChange(false)}>Annuleren</PillButton><PillButton onClick={() => void submit()} disabled={busy}>Afspraak inplannen</PillButton></>}>
      <div className="flex flex-col gap-5">
        {appointment||waitlist ? <p className="text-sm font-medium">{appointment?`${appointment.patient?.first_name} ${appointment.patient?.last_name}`:waitlist?.name}</p> : fixedPatient ? <p className="text-[14px] font-medium">{fixedPatient.first_name} {fixedPatient.last_name} · {fixedPatient.patient_number}</p> : <div className="flex flex-col gap-2">
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
        {history && <div className="flex flex-col gap-2 rounded-[14px] bg-sand p-4"><p className="text-sm font-medium">Patiënthistorie</p>{history.patient.labels.map(l=><span key={l} className="text-xs text-warning">{org?.options.find(o=>o.list_key==="patient_label" && o.value===l)?.label_nl??l}</span>)}{history.patient.online_booking_blocked && <p className="text-xs text-warning">Online boeken geblokkeerd</p>}{history.appointments.map((a,i)=><p key={i} className="text-xs text-muted-foreground">{new Date(a.starts_at).toLocaleDateString("nl-NL",{timeZone:"Europe/Amsterdam"})} · {a.treatment?.name_nl}</p>)}</div>}
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
          <Select label="Afspraaksoort" value={kind} onChange={setKind} options={appointmentOptions.filter(o=>o.list_key==="appointment_kind").map(o=>({value:o.value,label:o.label_nl}))}/>
          {how === "clinic" && <Select label="Kamer" value={room} onChange={setRoom} options={[{value:"",label:"Automatisch toewijzen"},...(org?.rooms??[]).filter(r=>r.location_id===loc).map(r=>({value:r.id,label:r.name}))]}/>}
        </div>
        <Checkbox label="Tentatieve afspraak" checked={tentative} onChange={setTentative}/>
        {preparation && <div className="rounded-[14px] bg-sand p-4 text-sm"><h3 className="font-semibold">Voorbereiding</h3><p className="mt-2">Persoonsgegevens: {preparation.detailsMissing?"nog aanvullen":"compleet"}</p><p>Vragenlijst: {!preparation.questionnaireRequired?"niet nodig":preparation.questionnaireMissing?"nog invullen of vernieuwen":"geldig"}</p>{preparation.consentRequired && <p>Toestemmingsformulier: {preparation.consentMissing?"nog ondertekenen of vernieuwen":"geldig"}</p>}</div>}
        <div className="flex flex-col gap-3"><h3 className="text-sm font-semibold">Patiëntberichten</h3>{moments.map(m=><div key={m.value} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-line py-2 text-sm"><span>{m.label}</span>{(["email","sms"] as const).map(channel=><Checkbox key={channel} label={channel==="email"?"E-mail":"Sms (demo)"} checked={notificationPlan[m.value]?.[channel]??channel==="email"} onChange={checked=>setNotificationPlan(p=>({...p,[m.value]:{email:p[m.value]?.email??true,sms:p[m.value]?.sms??false,[channel]:checked}}))}/>)}</div>)}</div>
        {canDouble && <><Checkbox label="Dubbel boeken met toestemming" checked={double} onChange={setDouble}/>{double && <div className="grid grid-cols-2 gap-3"><TextField label="Datum dubbelboeking" type="date" value={manualDate} onChange={e=>setManualDate(e.target.value)}/><TextField label="Tijd dubbelboeking" type="time" value={manualTime} onChange={e=>setManualTime(e.target.value)}/><TextArea label="Reden dubbelboeking" value={doubleReason} onChange={e=>setDoubleReason(e.target.value)}/></div>}</>}
        {error && <p className="rounded-[12px] bg-warning-bg px-4 py-3 text-[13px] text-warning">{error}</p>}
        <p className="text-[12px] text-muted-foreground">De afspraak krijgt een Meet-link via het gekoppelde account en komt op de tijdlijn van de patiënt.</p>
      </div>
    </Modal>
  );
}
