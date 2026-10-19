import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { standaloneConsultsQuery } from "@/data/consults";
import { measurementsQuery } from "@/data/measurements";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { dossierQuery } from "@/data/patients";
import { buildTimeline, type TimelineKind } from "@/features/dossier/timeline";
import { TimelineList } from "@/features/dossier/TimelineList";
import { dossierEntriesQuery,entryOptionsQuery } from "@/data/dossier-entries";
import { EntryModal } from "@/features/dossier/EntryModal";
import type { TimelineEvent } from "@/features/dossier/timeline";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patienten/$id/tijdlijn")({ head: () => ({ meta: [{ title: "Tijdlijn · Dossier · The Body Clinic" }, { name: "description", content: "Afspraken en consulten chronologisch in het patiëntendossier." }, { property: "og:title", content: "Tijdlijn · The Body Clinic" }, { property: "og:description", content: "Afspraken en consulten chronologisch in het patiëntendossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Timeline });

const FILTERS: Array<[TimelineKind | "all", string]> = [["all", "Alles"], ["appointments", "Afspraken en consulten"], ["questionnaires", "Vragenlijsten"], ["contact", "E-mails en contact"], ["treatment", "Behandeling en metingen"], ["system", "Systeem"]];

function Timeline() {
  const { id: key } = Route.useParams();
  const id = useSuspenseQuery(dossierQuery(key)).data.patient?.id ?? "";
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const { data: consults = [] } = useQuery(standaloneConsultsQuery(id));
  const { data: measurements = [] } = useQuery(measurementsQuery(id));
  const { data: entries } = useQuery(dossierEntriesQuery(id));
  const { data: options } = useQuery(entryOptionsQuery);
  const [editing,setEditing]=useState<{kind:"contact"|"request";id:string}|null>(null);
  const label=(list:string,value:string)=>options?.options.find(x=>x.list_key===list&&x.value===value)?.label_nl??"";
  const extra:TimelineEvent[]=[...(entries?.contacts??[]).map(x=>({at:x.occurred_at,kind:"contact" as const,icon:x.kind==="phone"?"mobiel":x.kind==="email"?"e-mail":"chat",title:`${label("contact_kind",x.kind)} · ${x.subject}`,body:x.body,who:entries?.names[x.created_by??""]??"",entry:{kind:"contact" as const,id:x.id}})),...(entries?.requests??[]).map(x=>({at:x.created_at,kind:"contact" as const,icon:"document",title:`${label("request_kind",x.kind)} · ${label("request_status",x.status)}`,body:[x.explanation,x.duration_months?label("request_duration",String(x.duration_months)):"",label("request_destination",x.destination)].filter(Boolean).join(" · "),who:entries?.names[x.created_by??""]??"",entry:{kind:"request" as const,id:x.id}}))];
  const [f, setF] = useState<TimelineKind | "all">("all");
  const events = [...buildTimeline(d, consults, measurements),...extra].sort((a,b)=>b.at.localeCompare(a.at)).filter((e) => f === "all" || e.kind === f);
  return (
    <section className="rounded-[20px] p-6 ring-1 ring-mist">
      <h3 className="text-[17px] font-semibold">Tijdlijn</h3>
      <p className="text-[13px] text-muted-foreground">Alles wat er met en voor deze patiënt gebeurde, in volgorde</p>
      <div className="my-5 flex gap-2 overflow-x-auto">
        {FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setF(k)} className={cn("whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", f === k ? "bg-primary text-primary-foreground" : "bg-sand")}>{l}</button>)}
      </div>
      <TimelineList events={events} onEdit={setEditing} />
      {editing&&<EntryModal patientId={id} kind={editing.kind} contact={entries?.contacts.find(x=>x.id===editing.id)} request={entries?.requests.find(x=>x.id===editing.id)} defaultDoctor={d.appointments.at(-1)?.practitioner_id} onClose={()=>setEditing(null)}/>}
    </section>
  );
}
