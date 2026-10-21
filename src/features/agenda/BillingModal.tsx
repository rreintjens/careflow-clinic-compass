import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useServerFn} from '@tanstack/react-start';
import {Modal} from '@/components/Modal';
import {PillButton} from '@/components/PillButton';
import {TextField,TextArea,Checkbox} from '@/components/Field';
import {Select} from '@/components/Select';
import {readBilling,settleBilling} from '@/data/billing.functions';
import {billingTotals,validateSettlement,type BillingLine,type Settlement} from '@/domain/billing';
import {euros} from '@/domain/consult-steps';
import {toast} from 'sonner';
import {downloadInvoice} from '@/features/portal/invoice-pdf';

export function BillingModal({appointmentId,onClose}:{appointmentId:string;onClose:()=>void}){
 const read=useServerFn(readBilling);const {data,error}=useQuery({queryKey:['billing',appointmentId],queryFn:()=>read({data:{appointmentId}})});
 const settled=data?.settlement;
 return <Modal open onOpenChange={onClose} title='Afrekenen' width='lg'>{error?<p role='alert'>Afrekenen kon niet worden geladen.</p>:!data?<p role='status'>Laden…</p>:settled?<div className='flex flex-col gap-4'><p>{settled.without_invoice?'Afgesloten zonder factuur':`Betaald · Factuur ${settled.invoice_number}`}</p><p>{euros(settled.total_cents)}</p>{!settled.without_invoice&&<PillButton onClick={()=>void downloadInvoice(settled).catch(()=>toast.error('PDF maken is niet gelukt.'))}>Bekijk factuur</PillButton>}</div>:<BillingForm appointmentId={appointmentId} initial={data} onClose={onClose}/>}</Modal>;
}
function BillingForm({appointmentId,initial,onClose}:{appointmentId:string;initial:Awaited<ReturnType<typeof readBilling>>;onClose:()=>void}){
 const [lines,setLines]=useState<BillingLine[]>(initial.lines);const [product,setProduct]=useState('');
 const total=(()=>{try{return billingTotals(lines);}catch{return null;}})();
 const [payments,setPayments]=useState<Settlement['payments']>([{method:initial.methods[0]?.value??'',amountCents:total?.totalCents??0}]);
 const [withoutInvoice,setWithoutInvoice]=useState(false);const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const settle=useServerFn(settleBilling);const qc=useQueryClient();
 const edit=(i:number,change:Partial<BillingLine>)=>setLines(ls=>ls.map((l,j)=>i===j?{...l,...change}:l));
 const save=async()=>{setBusy(true);setError('');try{const input=validateSettlement({appointmentId,lines,payments:withoutInvoice?[]:payments,withoutInvoice,reason});await settle({data:input});await Promise.all(['agenda-appts','dossier','portal','stats','billing','reception-tasks'].map(k=>qc.invalidateQueries({queryKey:[k]})));toast.success(withoutInvoice?'Afgesloten zonder factuur':'Demobetaling ontvangen; factuur aangemaakt');onClose();}catch(e){setError(e instanceof Error?e.message:'Afrekenen is niet gelukt.');}finally{setBusy(false);}};
 return <div className='flex flex-col gap-5'>
 {lines.map((l,i)=><div key={i} className='border-b border-line pb-4'><div className='flex items-center justify-between gap-3'><h3 className='text-sm font-medium'>{l.name}</h3><PillButton variant='ghost' size='sm' aria-label={`Verwijder regel ${i+1}`} onClick={()=>setLines(ls=>ls.filter((_,j)=>j!==i))}><img src='/ui-icons/kruis.svg' alt='' className='size-4'/></PillButton></div><div className='mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4'><TextField label={`Aantal · ${l.unit}`} type='number' min='0.01' step='0.01' value={l.qty} onChange={e=>edit(i,{qty:Number(e.target.value)})}/><TextField label='Prijs per stuk (€)' type='number' min='0' step='0.01' value={l.priceCents/100} onChange={e=>edit(i,{priceCents:Math.round(Number(e.target.value)*100)})}/><TextField label='Regelkorting (€)' type='number' min='0' step='0.01' value={l.discountCents/100} onChange={e=>edit(i,{discountCents:Math.round(Number(e.target.value)*100)})}/><div className='flex flex-col gap-2 text-sm'><span>Btw {l.vatRate}%</span><span>{total?.rows[i]&&euros(total.rows[i].totalCents)}</span></div></div></div>)}
 <div className='flex items-end gap-3'><Select label='Behandeling / product' className='flex-1' value={product} onChange={setProduct} options={initial.catalog.map(t=>({value:t.id,label:t.name_nl}))}/><PillButton aria-label='Voeg betaalregel toe' disabled={!product} onClick={()=>{const t=initial.catalog.find(t=>t.id===product);if(t)setLines(ls=>[...ls,{treatmentId:t.id,name:t.name_nl,qty:1,unit:t.price_per??'',priceCents:t.price_cents??0,discountCents:0,vatRate:t.effectiveVatRate}]);setProduct('');}}><img src='/ui-icons/plus.svg' alt='' className='size-4'/></PillButton></div>
 <p className='text-lg font-semibold'>Totaal {total?euros(total.totalCents):'–'} <span className='text-sm font-normal text-muted-foreground'>(btw {total?euros(total.vatCents):'–'})</span></p>
 <Checkbox label='Afsluiten zonder factuur' checked={withoutInvoice} onChange={setWithoutInvoice}/>
 {withoutInvoice?<TextArea label='Reden' value={reason} onChange={e=>setReason(e.target.value)}/>:<>{payments.map((p,i)=><div key={i} className='flex items-end gap-3'><Select label='Betaalwijze' className='flex-1' value={p.method} onChange={v=>setPayments(ps=>ps.map((x,j)=>i===j?{...x,method:v}:x))} options={initial.methods.map(m=>({value:m.value,label:m.label_nl}))}/><TextField label='Bedrag (€)' className='w-36' type='number' min='0' step='0.01' value={p.amountCents/100} onChange={e=>setPayments(ps=>ps.map((x,j)=>i===j?{...x,amountCents:Math.round(Number(e.target.value)*100)}:x))}/><PillButton variant='ghost' aria-label={`Verwijder betaling ${i+1}`} onClick={()=>setPayments(ps=>ps.filter((_,j)=>j!==i))}><img src='/ui-icons/kruis.svg' alt='' className='size-4'/></PillButton></div>)}<PillButton variant='ghost' className='self-start' onClick={()=>setPayments(ps=>[...ps,{method:initial.methods[0]?.value??'',amountCents:Math.max(0,(total?.totalCents??0)-ps.reduce((s,p)=>s+p.amountCents,0))}])}>Betaling splitsen</PillButton></>}
 {error&&<p role='alert' className='text-sm text-warning'>{error}</p>}<div className='flex justify-end gap-3'><PillButton variant='ghost' onClick={onClose}>Sluiten</PillButton><PillButton disabled={busy||!total||!lines.length} onClick={()=>void save()}>{withoutInvoice?'Afsluiten zonder factuur':'Betaling ontvangen (demo)'}</PillButton></div>
 </div>;
}