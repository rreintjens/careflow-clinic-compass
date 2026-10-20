import { createFileRoute } from "@tanstack/react-router";
import {PageHeader} from "@/components/PageHeader";
import {ListPage,DataTable,RowChevron} from "@/components/ListPage";
import {TextField,SearchField,thCls,tdCls} from "@/components/Field";
import {Select} from "@/components/Select";
import {PillButton} from "@/components/PillButton";
import {Modal} from "@/components/Modal";
import {useState} from "react";
import {useSuspenseQuery,useQueryClient} from "@tanstack/react-query";
import {addressBookQuery,addressOptionsQuery} from "@/data/address-book";
import {saveAddress} from "@/data/address-book.functions";
import {toast} from "sonner";

const TITLE = "Adresboek · The Body Clinic";
const DESC = "Huisartsen en apotheken van je patiënten.";
export const Route = createFileRoute("/_authenticated/dossier/adresboek")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader:async({context})=>{await Promise.all([context.queryClient.ensureQueryData(addressBookQuery),context.queryClient.ensureQueryData(addressOptionsQuery)]);},
  component:AddressBook,
});

function AddressBook(){
 const {data:rows}=useSuspenseQuery(addressBookQuery);const {data:options}=useSuspenseQuery(addressOptionsQuery);const qc=useQueryClient();
 const [search,setSearch]=useState("");const [kind,setKind]=useState("");const [editing,setEditing]=useState(false);const [saving,setSaving]=useState(false);
 const empty={id:"",name:"",kind:"",city:"",phone:"",send_channel:""};const [form,setForm]=useState(empty);
 const filtered=rows.filter(r=>(!kind||r.kind===kind)&&`${r.name} ${r.city}`.toLowerCase().includes(search.toLowerCase()));
 const opts=(key:string)=>options.filter(o=>o.list_key===key).map(o=>({value:o.value,label:o.label_nl}));
 const save=async()=>{setSaving(true);try{await saveAddress({data:{...form,id:form.id||undefined}});await Promise.all(["address-book","consult-page"].map(key=>qc.invalidateQueries({queryKey:[key]})));setEditing(false);toast.success("Adres opgeslagen");}catch(e){toast.error(e instanceof Error?e.message:"Opslaan is niet gelukt");}finally{setSaving(false);}};
 return <ListPage><PageHeader title="Adresboek" actions={<PillButton onClick={()=>{setForm(empty);setEditing(true);}}>Adres toevoegen</PillButton>}/><div className="flex flex-wrap gap-3"><SearchField placeholder="Zoek naam of plaats" value={search} onChange={e=>setSearch(e.target.value)}/><Select label="Soort" value={kind} onChange={setKind} options={[{value:"",label:"Alle soorten"},...opts("address_kind")]}/></div><DataTable count={filtered.length}><table className="w-full"><thead><tr>{["Naam","Soort","Plaats","Telefoon","Verzendkanaal",""].map(h=><th key={h} className={thCls}>{h}</th>)}</tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-t border-line"><td className={tdCls}>{r.name}</td><td className={tdCls}>{opts("address_kind").find(o=>o.value===r.kind)?.label}</td><td className={tdCls}>{r.city}</td><td className={tdCls}>{r.phone}</td><td className={tdCls}>{opts("secure_mail_channel").find(o=>o.value===r.send_channel)?.label}</td><td className={tdCls}><PillButton data-row-action variant="ghost" size="sm" aria-label={`Open ${r.name}`} onClick={()=>{setForm({id:r.id,name:r.name,kind:r.kind,city:r.city,phone:r.phone,send_channel:r.send_channel});setEditing(true);}}><RowChevron/></PillButton></td></tr>)}</tbody></table></DataTable>{editing&&<Modal open onOpenChange={setEditing} title={form.id?"Adres aanpassen":"Adres toevoegen"} footer={<><PillButton variant="outline" onClick={()=>setEditing(false)}>Annuleren</PillButton><PillButton disabled={saving} onClick={()=>void save()}>Opslaan</PillButton></>}><div className="grid grid-cols-2 gap-4"><TextField label="Naam" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/><Select label="Soort" value={form.kind} onChange={kind=>setForm(p=>({...p,kind}))} options={opts("address_kind")}/><TextField label="Plaats" value={form.city} onChange={e=>setForm(p=>({...p,city:e.target.value}))}/><TextField label="Telefoon" value={form.phone} onChange={e=>setForm(p=>({...p,phone:e.target.value}))}/><Select label="Verzendkanaal" value={form.send_channel} onChange={send_channel=>setForm(p=>({...p,send_channel}))} options={opts("secure_mail_channel")}/></div></Modal>}</ListPage>;
}
