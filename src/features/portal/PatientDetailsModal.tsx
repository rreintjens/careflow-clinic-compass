import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {Modal} from "@/components/Modal";
import {TextField} from "@/components/Field";
import {PillButton} from "@/components/PillButton";
import {readPatientDetails,savePatientDetails} from "@/data/patient-details.functions";
import {patientDetailsSchema} from "@/domain/patient-details";
export function PatientDetailsModal({onClose}:{onClose:()=>void}){
 const read=useServerFn(readPatientDetails);const {data,error}=useQuery({queryKey:["patient-details"],queryFn:()=>read()});
 return <Modal open onOpenChange={o=>{if(!o)onClose();}} title="Persoonsgegevens en adres">{data?<DetailsForm initial={data} onClose={onClose}/>:<p role={error?"alert":undefined}>{error?"Je gegevens zijn niet beschikbaar.":"Laden…"}</p>}</Modal>;
}
function DetailsForm({initial,onClose}:{initial:Awaited<ReturnType<typeof readPatientDetails>>;onClose:()=>void}){
 const [form,setForm]=useState({date_of_birth:initial.date_of_birth??"",phone:initial.phone??"",postcode:initial.postcode??"",house_number:initial.house_number??"",house_suffix:initial.house_suffix??"",street:initial.street??"",city:initial.city??""});const [error,setError]=useState("");const [busy,setBusy]=useState(false);const save=useServerFn(savePatientDetails);const qc=useQueryClient();
 const submit=async()=>{const parsed=patientDetailsSchema.safeParse(form);if(!parsed.success){setError(parsed.error.issues[0]?.message??"Vul je gegevens aan.");return;}setBusy(true);try{await save({data:parsed.data});await qc.invalidateQueries({queryKey:["patient-details"]});await qc.invalidateQueries({queryKey:["portal"]});onClose();}catch(e){setError(e instanceof Error?e.message:"Opslaan is niet gelukt.");}finally{setBusy(false);}};
 const field=(key:keyof typeof form,label:string,type="text")=><TextField label={label} type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/>;
 return <div className="flex flex-col gap-4">{field("date_of_birth","Geboortedatum","date")}{field("phone","Telefoon","tel")}<div className="grid grid-cols-2 gap-4">{field("postcode","Postcode")}{field("house_number","Huisnummer")}{field("house_suffix","Toevoeging")}</div>{field("street","Straat")}{field("city","Plaats")}{error&&<p role="alert" className="text-sm text-warning">{error}</p>}<div className="flex justify-end gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={busy} onClick={()=>void submit()}>Opslaan</PillButton></div></div>;
}