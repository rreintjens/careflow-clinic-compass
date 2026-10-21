import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {toast} from 'sonner';
import {Card} from '@/components/Card';
import {Modal} from '@/components/Modal';
import {PillButton} from '@/components/PillButton';
import {TextField,Checkbox} from '@/components/Field';
import {Select} from '@/components/Select';
import {supabase} from '@/integrations/supabase/client';
import {templatesQuery} from '@/data/dossier';
import {opts,type Org,type Treatment} from '@/data/organisation';
import {treatmentSettingsSchema} from '@/domain/treatment-settings';

export function TreatmentSettings({treatment:t,org}:{treatment:Treatment;org:Org}){
 const [open,setOpen]=useState(false);
 return <Card title='Prijs, materiaal en dossier'><div className='flex items-center justify-between gap-4'><p className='text-sm'>{new Intl.NumberFormat('nl-NL',{style:'currency',currency:'EUR'}).format((t.price_cents??0)/100)} · {t.btw_rate}% btw · {org.options.find(o=>o.list_key==='treatment_online_booking'&&o.value===t.online_booking)?.label_nl}</p><PillButton variant='ghost' onClick={()=>setOpen(true)}>Aanpassen</PillButton></div>{open&&<SettingsModal treatment={t} org={org} onClose={()=>setOpen(false)}/>}</Card>;
}
function SettingsModal({treatment:t,org,onClose}:{treatment:Treatment;org:Org;onClose:()=>void}){
 const [d,setD]=useState({price_cents:t.price_cents,price_per:t.price_per,btw_rate:Number(t.btw_rate),vat_exemption_possible:t.vat_exemption_possible,material_brand:t.material_brand,material_unit:t.material_unit,lot_required:t.lot_required,supplier:t.supplier,reminder_days:t.reminder_days??0,online_booking:t.online_booking,dossier_template_override:t.dossier_template_override});
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');const qc=useQueryClient();const {data:templates}=useQuery(templatesQuery);
 const save=async()=>{setBusy(true);setError('');try{const row=treatmentSettingsSchema.parse(d);const r=await supabase.from('treatments').update({...row,btw_rate:String(row.btw_rate)}).eq('id',t.id).select('id').single();if(r.error)throw r.error;await Promise.all(['org','billing','booking'].map(key=>qc.invalidateQueries({queryKey:[key]})));toast.success('Opgeslagen');onClose();}catch{setError('Controleer de ingevulde gegevens. Opslaan is niet gelukt.');}finally{setBusy(false);}};
 return <Modal open onOpenChange={onClose} title={`Prijs, materiaal en dossier · ${t.name_nl}`} width='lg' footer={<><PillButton variant='ghost' onClick={onClose}>Annuleren</PillButton><PillButton disabled={busy} onClick={()=>void save()}>Opslaan</PillButton></>}><div className='grid grid-cols-2 gap-4'>
 <TextField label='Prijs (€)' type='number' min='0' step='0.01' value={d.price_cents===null?'':d.price_cents/100} onChange={e=>setD({...d,price_cents:e.target.value===''?null:Math.round(Number(e.target.value)*100)})}/>
 <Select label='Prijs per' value={d.price_per??''} onChange={v=>setD({...d,price_per:v||null})} options={opts(org,'price_per')}/>
 <Select label='Btw' value={String(d.btw_rate)} onChange={v=>setD({...d,btw_rate:Number(v)})} options={opts(org,'btw_rate')}/>
 <Checkbox label='Btw-vrijstelling mogelijk' checked={d.vat_exemption_possible} onChange={v=>setD({...d,vat_exemption_possible:v})}/>
 <TextField label='Materiaalmerk' value={d.material_brand??''} onChange={e=>setD({...d,material_brand:e.target.value||null})}/>
 <Select label='Materiaaleenheid' value={d.material_unit??''} onChange={v=>setD({...d,material_unit:v||null})} options={opts(org,'material_unit')}/>
 <TextField label='Leverancier' value={d.supplier??''} onChange={e=>setD({...d,supplier:e.target.value||null})}/>
 <Checkbox label='Lotnummer verplicht' checked={d.lot_required} onChange={v=>setD({...d,lot_required:v})}/>
 <TextField label='Herinnering na (dagen)' type='number' min='0' step='1' value={d.reminder_days} onChange={e=>setD({...d,reminder_days:Number(e.target.value)})}/>
 <Select label='Online boekbaar' value={d.online_booking} onChange={v=>setD({...d,online_booking:v})} options={opts(org,'treatment_online_booking')}/>
 <Select className='col-span-2' label='Dossiersjabloon' value={d.dossier_template_override??'category'} onChange={v=>setD({...d,dossier_template_override:v==='category'?null:v})} options={[{value:'category',label:'Sjablonen van de categorieën'},...(templates?.templates??[]).map(x=>({value:x.id,label:x.name}))]}/>
 {error&&<p role='alert' className='col-span-2 text-sm text-warning'>{error}</p>}
 </div></Modal>;
}