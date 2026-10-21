import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { TextArea } from "@/components/Field";
import { appointmentHistoryQuery, appointmentStatusOptionsQuery,appointmentSmsQuery,appointmentFeesQuery } from "@/data/reception";
import {requestCancellationFee} from "@/data/appointment-fees.functions";
import {Link} from "@tanstack/react-router";
import {supabase} from "@/integrations/supabase/client";
import { changeAppointmentStatus } from "@/data/reception.functions";
import { receptionTransitions } from "@/domain/appointment-status";
import type { AgendaAppt } from "@/data/agenda";
import { agendaRefQuery } from "@/data/agenda";
import { NewAppointmentModal } from "./NewAppointmentModal";

export function AppointmentStatus({ status }: { status: string }) {
  const { data: opts = [] } = useQuery(appointmentStatusOptionsQuery);
  return <span className="inline-flex whitespace-nowrap rounded-full bg-teal-light px-2.5 py-1 text-xs text-primary-hover">{opts.find(o => o.list_key === "appointment_status" && o.value === status)?.label_nl ?? status}</span>;
}
export function AppointmentActions({ appointment }: { appointment: AgendaAppt }) {
  const [open, setOpen] = useState(false);
  const [moving,setMoving]=useState(false);
  const {data:ref}=useQuery(agendaRefQuery);
  const [status, setStatus] = useState(appointment.status);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState(appointment.reception_note ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fn = useServerFn(changeAppointmentStatus);
  const qc = useQueryClient();
  const { data: opts = [] } = useQuery(appointmentStatusOptionsQuery);
  const { data: history = [] } = useQuery({ ...appointmentHistoryQuery(appointment.id), enabled: open });
  const {data:sms=[]}=useQuery({...appointmentSmsQuery(appointment.id),enabled:open});
  const {data:fees=[]}=useQuery({...appointmentFeesQuery(appointment.id),enabled:open});
  const {data:canCharge=false}=useQuery({queryKey:["can-charge-fee"],queryFn:async()=>!!(await supabase.rpc("has_permission",{_perm:"billing.till"})).data});
  const charge=async()=>{setBusy(true);try{await requestCancellationFee({data:{appointmentId:appointment.id}});await qc.invalidateQueries({queryKey:["appointment-fees",appointment.id]});}catch(e){setError(e instanceof Error?e.message:"Betaalverzoek niet aangemaakt.");}finally{setBusy(false);}};
  const allowed = receptionTransitions(appointment.status);
  const label = (value: string) => opts.find(o => o.list_key === "appointment_status" && o.value === value)?.label_nl ?? value;
  const save = async () => {
    setBusy(true); setError("");
    try {
      await fn({ data: { id: appointment.id, expectedStatus: appointment.status, status, reason: reason || null, note } });
      await Promise.all(["agenda-appts", "appointment-status-history", "dossier", "patient-list", "portal", "stats", "reception-tasks"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "Opslaan is niet gelukt."); }
    finally { setBusy(false); }
  };
  return <>
    <div className="flex flex-wrap items-center gap-2"><AppointmentStatus status={appointment.status}/><PillButton variant="ghost" size="sm" onClick={() => { setStatus(allowed[0] ?? appointment.status); setNote(appointment.reception_note ?? ""); setError(""); setOpen(true); }}>Afspraak en geschiedenis</PillButton></div>
    {appointment.reception_note && <p className="text-sm text-muted-foreground">{appointment.reception_note}</p>}
    {["booked","tentatief"].includes(appointment.status) && <PillButton variant="ghost" size="sm" onClick={()=>setMoving(true)}>Afspraak verzetten</PillButton>}
    {allowed.includes("cancelled")&&<PillButton variant="ghost" size="sm" onClick={()=>{setStatus("cancelled");setReason("");setNote(appointment.reception_note??"");setError("");setOpen(true);}}>Afspraak annuleren</PillButton>}
    {moving && ref && <NewAppointmentModal open onOpenChange={setMoving} data={ref} appointment={appointment} onPickInAgenda={()=>setMoving(false)}/>}
    <Modal open={open} onOpenChange={setOpen} title={status==="cancelled"?"Afspraak annuleren":"Afspraak en geschiedenis"} footer={<><PillButton variant="outline" onClick={() => setOpen(false)}>Sluiten</PillButton>{allowed.length > 0 && <PillButton disabled={busy || status === appointment.status||(status==="cancelled"&&!reason)} onClick={() => void save()}>Opslaan</PillButton>}</>}>
      <div className="flex flex-col gap-4">
        <AppointmentStatus status={appointment.status}/>
        {!!allowed.length && <><Select label="Nieuwe status" value={status} onChange={setStatus} options={allowed.map(value => ({ value, label: label(value) }))}/>{status === "cancelled" && <Select label="Annuleringsreden" value={reason} onChange={setReason} options={opts.filter(o => o.list_key === "cancel_reason").map(o => ({ value: o.value, label: o.label_nl }))}/>}<TextArea label="Notitie voor receptie" value={note} onChange={e => setNote(e.target.value)}/></>}
        {error && <p role="alert" className="text-sm text-warning">{error}</p>}
        {["cancelled","no_show"].includes(appointment.status)&&canCharge&&fees.length===0&&<PillButton variant="outline" disabled={busy} onClick={()=>void charge()}>Betaalverzoek volgens annuleringsvoorwaarden</PillButton>}
        {fees.map(f=><div key={f.id} className="rounded-[14px] bg-sand p-3 text-sm"><p>{new Intl.NumberFormat("nl-NL",{style:"currency",currency:"EUR"}).format(f.amount_cents/100)} · {f.status==="paid"?"Betaald":f.status==="open"?"Open":"Ingetrokken"}</p>{f.status==="open"&&<Link to="/betalen/$token" params={{token:f.demo_token}} target="_blank" className="text-primary">Open demo-betaallink</Link>}</div>)}
        <h3 className="text-sm font-semibold">Statusgeschiedenis</h3>
        {sms.length>0 && <div className="rounded-[14px] bg-sand p-3 text-sm"><h3 className="font-semibold">Sms (demo)</h3>{sms.map(s=><p key={s.id}>{ref?.options.find(o=>o.list_key==="mail_moment"&&o.value===s.moment)?.label_nl} · {new Date(s.created_at).toLocaleString("nl-NL",{timeZone:"Europe/Amsterdam",dateStyle:"short",timeStyle:"short"})} · Niet echt verstuurd</p>)}</div>}
        {history.length ? history.map(h => <div key={h.id} className="border-b border-line py-2 text-sm"><p>{label(h.from_status ?? "")} → {label(h.to_status)}</p><p className="text-xs text-muted-foreground">{h.author} · {new Date(h.created_at).toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", dateStyle: "medium", timeStyle: "short" })}</p>{h.reason && <p>{opts.find(o => o.list_key === "cancel_reason" && o.value === h.reason)?.label_nl ?? h.reason}</p>}{h.note && <p className="text-muted-foreground">{h.note}</p>}</div>) : <p className="text-sm text-muted-foreground">Nog geen statuswijzigingen</p>}
      </div>
    </Modal>
  </>;
}