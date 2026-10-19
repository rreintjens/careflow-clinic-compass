import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Checkbox } from "@/components/Field";
import { dossierEntriesQuery,entryOptionsQuery,followUpsQuery } from "@/data/dossier-entries";
import { completeFollowUp } from "@/data/dossier-entries.functions";
import { toast } from "sonner";
export function FollowUps({patientId}:{patientId?:string}) {
 const own=useQuery({...followUpsQuery,enabled:!patientId});const record=useQuery(dossierEntriesQuery(patientId??""));const {data:options}=useQuery(entryOptionsQuery);const qc=useQueryClient();
 const rows=patientId?(record.data?.contacts??[]).filter(x=>x.follow_up&&!x.done).map(x=>({...x,patient:null})):own.data??[];
 const t=(k:string)=>options?.options.find(x=>x.list_key==="dossier_entry_ui"&&x.value===k)?.label_nl??"";
 const done=useMutation({mutationFn:(id:string)=>completeFollowUp({data:{id,done:true}}),onSuccess:()=>Promise.all([qc.invalidateQueries({queryKey:["follow-ups"]}),qc.invalidateQueries({queryKey:["dossier-entries"]})]),onError:()=>toast.error("Opslaan is niet gelukt")});
 if(!rows.length)return null;
 return <section className="flex flex-col gap-3"><h3 className="text-[17px] font-semibold">{t("follow_ups")}</h3>{rows.map(r=><div key={r.id} className="flex items-center justify-between gap-3 border-b border-mist pb-3 text-sm"><div><p>{r.follow_up}</p><p className="text-xs text-muted-foreground">{r.due_on}{r.assigned_to&&patientId?` · ${options?.staff.find(x=>x.id===r.assigned_to)?.full_name??""}`:""}{r.patient&&<> · <Link to="/patienten/$id" params={{id:String(r.patient.patient_number)}} className="text-primary underline">{r.patient.first_name} {r.patient.last_name}</Link></>}</p></div><Checkbox label={t("done")} checked={false} disabled={done.isPending} onChange={()=>done.mutate(r.id)}/></div>)}</section>;
}