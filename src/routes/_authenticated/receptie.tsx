import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { PageHeader } from "@/components/PageHeader";
import { ListPage, DataTable, RowChevron } from "@/components/ListPage";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { Card } from "@/components/Card";
import { TextField, thCls, tdCls } from "@/components/Field";
import { agendaApptsQuery, agendaRefQuery } from "@/data/agenda";
import { receptionTasksQuery, appointmentStatusOptionsQuery } from "@/data/reception";
import { uiTextsQuery, textOf } from "@/data/ui-texts";
import { PatientCard } from "@/features/agenda/PatientCard";
import { AppointmentStatus } from "@/features/agenda/AppointmentActions";
import { NewAppointmentModal } from "@/features/agenda/NewAppointmentModal";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" });
const range = (d: string) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - 1); const y = new Date(x); y.setUTCDate(y.getUTCDate() + 3); return [x.toISOString(), y.toISOString()] as const; };
const local = (iso: string) => ({ date: new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }), minute: Number(new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit" })) * 60 + Number(new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Amsterdam", minute: "2-digit" })) });
const title = "Receptie · The Body Clinic"; // Shared operational appointment view.
const description = "Aankomst, afspraakstatus en overdracht aan de receptie van The Body Clinic.";
export const Route = createFileRoute("/_authenticated/receptie")({
  validateSearch: z.object({ datum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), locatie: z.string().optional() }),
  head: () => ({ meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(agendaRefQuery), context.queryClient.ensureQueryData(uiTextsQuery("reception_ui"))]); },
  component: Reception,
});
function Reception() {
  const search = Route.useSearch();
  const { data: ref } = useSuspenseQuery(agendaRefQuery);
  const { data: texts } = useSuspenseQuery(uiTextsQuery("reception_ui"));
  const date = search.datum ?? today();
  const [location, setLocation] = useState(search.locatie ?? "all");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [waiting,setWaiting]=useState<{id:string;patientId:string;treatmentId:string|null;name:string}|null>(null);
  const [from, to] = range(date);
  const { data: raw = [] } = useQuery(agendaApptsQuery(from, to));
  const { data: options = [] } = useQuery(appointmentStatusOptionsQuery);
  const { data: tasks } = useQuery(receptionTasksQuery);
  const rows = raw.map(a => ({ ...a, s: local(a.starts_at), e: local(a.ends_at) })).filter(a => a.s.date === date && (location === "all" || a.location_id === location)).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const shown = rows.filter(a => status === "all" || a.status === status);
  const a = rows.find(x => x.id === selected);
  const t = (key: string) => textOf(texts, key);
  return <ListPage>
    <PageHeader title={t("title")} actions={<PillButton onClick={() => setNewOpen(true)}>Afspraak maken</PillButton>}/>
    <div className="flex flex-wrap items-center gap-3"><DatePicker date={date}/><Select label="Locatie" className="w-52 [&>label]:sr-only" value={location} onChange={setLocation} options={[{ value: "all", label: t("all_locations") }, ...ref.locations.map(l => ({ value: l.id, label: l.name }))]}/><Select label="Status" className="w-52 [&>label]:sr-only" value={status} onChange={setStatus} options={[{ value: "all", label: t("all_statuses") }, ...options.filter(o => o.list_key === "appointment_status").map(o => ({ value: o.value, label: o.label_nl }))]}/><span className="text-xs text-muted-foreground">{shown.length} afspraken</span></div>
    <div className="grid items-start gap-6 min-[1440px]:grid-cols-[minmax(0,1fr)_300px]">
      <DataTable count={shown.length} className="[&_td:first-child]:min-w-20"><table className="w-full"><thead><tr>{["Tijd", "Patiënt", "Behandeling", "Behandelaar / locatie", "Status", ""].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead><tbody>{shown.map(r => <tr key={r.id} className="border-t border-line"><td className={tdCls}>{new Date(r.starts_at).toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" })}</td><td className={tdCls}>{r.patient?.first_name} {r.patient?.last_name}<p className="text-xs text-muted-foreground">{r.patient?.patient_number}</p></td><td className={tdCls}>{ref.treatments.find(x => x.id === r.treatment_id)?.name_nl}</td><td className={tdCls}>{(() => { const p = ref.practitioners.find(x => x.id === r.practitioner_id); return p ? `${p.first_name} ${p.last_name}` : ""; })()}<p className="text-xs text-muted-foreground">{ref.locations.find(x => x.id === r.location_id)?.name}</p></td><td className={tdCls}><AppointmentStatus status={r.status}/></td><td className={tdCls}><PillButton data-row-action variant="ghost" size="sm" aria-label={`Open afspraak ${r.patient?.first_name ?? ""}`} onClick={() => setSelected(r.id)}><RowChevron/></PillButton></td></tr>)}</tbody></table></DataTable>
      <aside className="flex flex-col gap-4">
        {[{ key: "waiting", status: "gearriveerd" }, { key: "payment", status: "klaar_voor_betaling" }].map(c => <Card key={c.key} title={t(c.key)}><div className="flex flex-col gap-2">{rows.filter(r => r.status === c.status).map(r => <PillButton key={r.id} variant="ghost" className="h-auto justify-start whitespace-normal text-left" onClick={() => setSelected(r.id)}>{r.patient?.first_name} {r.patient?.last_name}</PillButton>)}<p className="text-xs text-muted-foreground">{rows.filter(r => r.status === c.status).length}</p></div></Card>)}
        <Card title={t("open_records")}><div className="flex flex-col gap-2">{tasks?.notes.filter(n => rows.some(r => r.id === n.appointment_id)).map(n => <Link key={n.id} to="/patienten/$id" params={{ id: String(n.patient?.patient_number ?? "") }} className="text-sm text-primary">{n.patient?.first_name} {n.patient?.last_name}</Link>)}</div></Card>
        <Card title={t("waitlist")}><div className="flex flex-col gap-2">{tasks?.waitlist.map(w => <PillButton key={w.id} variant="ghost" className="justify-start whitespace-normal text-left" onClick={()=>{if(w.patient)setWaiting({id:w.id,patientId:w.patient.id,treatmentId:w.treatment_id,name:`${w.patient.first_name} ${w.patient.last_name}`});}}>{w.patient?.first_name} {w.patient?.last_name}</PillButton>)}</div></Card>
      </aside>
    </div>
    {a && <aside className="fixed inset-y-0 right-0 z-30 w-[420px] max-w-full overflow-y-auto bg-background shadow-lg"><PatientCard a={a} online={ref.locations.find(l => l.id === a.location_id)?.kind === "online"} treatment={ref.treatments.find(t => t.id === a.treatment_id)?.name_nl ?? ""} onClose={() => setSelected("")}/></aside>}
    <NewAppointmentModal open={newOpen} onOpenChange={setNewOpen} data={ref} onPickInAgenda={() => setNewOpen(false)}/>
    {waiting && <NewAppointmentModal key={waiting.id} open onOpenChange={()=>setWaiting(null)} data={ref} waitlist={waiting} onPickInAgenda={()=>setWaiting(null)}/>}
  </ListPage>;
}
function DatePicker({ date }: { date: string }) {
  const navigate = Route.useNavigate();
  return <TextField label="Datum" type="date" value={date} className="w-44 [&>label]:sr-only" onChange={e => void navigate({ search: p => ({ ...p, datum: e.target.value }) })}/>;
}