import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox,TextArea,TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { entryOptionsQuery,type Entries } from "@/data/dossier-entries";
import { saveContact,saveRequest } from "@/data/dossier-entries.functions";
import { contactSchema,requestDestination,requestSchema } from "@/domain/dossier-entries";

const localInput=(iso:string)=>{const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
export function EntryModal({patientId,kind,contact,request,defaultDoctor,onClose}:{patientId:string;kind:"contact"|"request";contact?:Entries["contacts"][number] | undefined;request?:Entries["requests"][number] | undefined;defaultDoctor?:string | undefined;onClose:()=>void}) {
 const {data}=useQuery(entryOptionsQuery);const qc=useQueryClient();
 const [f,setF]=useState({kind:contact?.kind??request?.kind??(kind==="contact"?"phone":"package"),direction:contact?.direction??"incoming",subject:contact?.subject??"",body:contact?.body??"",at:localInput(contact?.occurred_at??new Date().toISOString()),follow:!!contact?.follow_up,what:contact?.follow_up??"",assignee:contact?.assigned_to??"",due:contact?.due_on??"",duration:String(request?.duration_months??1),explanation:request?.explanation??"",destination:request?.destination??"pharmacy",doctor:request?.practitioner_id??defaultDoctor??"",status:request?.status??"open"});
 const t=(key:string)=>data?.options.find(x=>x.list_key==="dossier_entry_ui"&&x.value===key)?.label_nl??"";
 const opts=(key:string)=>data?.options.filter(x=>x.list_key===key).map(x=>({value:x.value,label:x.label_nl}))??[];
 const change=(key:keyof typeof f,value:string|boolean)=>setF(old=>({...old,[key]:value}));
 const save=useMutation({mutationFn:async()=>kind==="contact"?saveContact({data:contactSchema.parse({id:contact?.id??null,patientId,kind:f.kind,direction:f.kind==="internal"?null:f.direction,subject:f.subject,body:f.body,occurredAt:new Date(f.at).toISOString(),followUp:f.follow?f.what:null,assignedTo:f.follow?f.assignee||null:null,dueOn:f.follow?f.due||null:null})}):saveRequest({data:requestSchema.parse({id:request?.id??null,patientId,kind:f.kind,durationMonths:f.kind==="package"?Number(f.duration):null,explanation:f.explanation,destination:f.destination,practitionerId:f.destination==="doctor"?f.doctor||null:null,status:f.status})}),onSuccess:async()=>{await Promise.all([qc.invalidateQueries({queryKey:["dossier-entries",patientId]}),qc.invalidateQueries({queryKey:["follow-ups"]})]);toast.success(t("saved"));onClose();},onError:(e)=>toast.error(e instanceof Error?e.message:"Opslaan is niet gelukt")});
 return <Modal open title={t(kind==="contact"?"contact_title":"request_title")} onOpenChange={o=>!o&&onClose()} footer={<><PillButton variant="outline" onClick={onClose}>{t("cancel")}</PillButton><PillButton disabled={!data||save.isPending} onClick={()=>save.mutate()}>{t("save")}</PillButton></>}>
 <div className="grid grid-cols-2 gap-4">
 <Select label={t("kind")} value={f.kind} options={opts(kind==="contact"?"contact_kind":"request_kind")} onChange={v=>setF(old=>({...old,kind:v,...(kind==="request"?{destination:requestDestination(v)}:{})}))}/>
 {kind==="contact"?<>
 {f.kind!=="internal"&&<Select label={t("direction")} value={f.direction} options={opts("contact_direction")} onChange={v=>change("direction",v)}/>}
 <TextField className="col-span-2" label={t("subject")} value={f.subject} onChange={e=>change("subject",e.target.value)}/>
 <TextArea className="col-span-2" label={t("body")} value={f.body} onChange={e=>change("body",e.target.value)}/>
 <TextField label={t("occurred_at")} type="datetime-local" value={f.at} onChange={e=>change("at",e.target.value)}/>
 <Checkbox label={t("follow_up")} checked={f.follow} onChange={v=>change("follow",v)}/>
 {f.follow&&<><TextField className="col-span-2" label={t("what")} value={f.what} onChange={e=>change("what",e.target.value)}/><Select label={t("assigned_to")} value={f.assignee} options={[{value:"",label:t("choose")},...(data?.staff??[]).map(x=>({value:x.id,label:x.full_name}))]} onChange={v=>change("assignee",v)}/><TextField label={t("due_on")} type="date" value={f.due} onChange={e=>change("due",e.target.value)}/></>}
 </>:<>
 {f.kind==="package"&&<Select label={t("duration")} value={f.duration} options={opts("request_duration")} onChange={v=>change("duration",v)}/>}
 <TextArea className="col-span-2" label={t("explanation")} value={f.explanation} onChange={e=>change("explanation",e.target.value)}/>
 <Select label={t("destination")} value={f.destination} options={opts("request_destination")} onChange={v=>change("destination",v)}/>
 {f.destination==="doctor"&&<Select label={t("doctor")} value={f.doctor} options={[{value:"",label:t("choose")},...(data?.doctors??[]).map(x=>({value:x.id,label:`${x.first_name} ${x.last_name}`}))]} onChange={v=>change("doctor",v)}/>}
 <Select label={t("status")} value={f.status} options={opts("request_status")} onChange={v=>change("status",v)}/>
 {request&&<p className="col-span-2 text-xs text-muted-foreground">{t("status_changed")} · {data?.staff.find(x=>x.id===request.status_changed_by)?.full_name} · {new Date(request.status_changed_at).toLocaleString("nl-NL")}</p>}
 </>}
 </div></Modal>;
}