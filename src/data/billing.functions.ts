import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {settlementSchema,validateSettlement,mockBillingPaymentProvider} from '@/domain/billing';
import {readStepData} from '@/domain/consult-steps';
import type {Json} from '@/integrations/supabase/types';

export const readBilling=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({appointmentId:z.string().uuid()})).handler(async({data,context})=>{
 const db=context.supabase;
 if(!(await db.rpc('is_aal2')).data||!(await db.rpc('has_permission',{_perm:'billing.till'})).data)throw new Error('Geen toegang.');
 const [a,c,m,settled]=await Promise.all([db.from('appointments').select('id,tenant_id,treatment_id,status').eq('id',data.appointmentId).single(),db.from('treatments').select('id,name_nl,price_cents,price_per,btw_rate,vat_exemption_possible').eq('status','active'),db.from('option_lists').select('value,label_nl').eq('list_key','billing_payment_method').order('sort'),db.from('billing_settlements').select('*').eq('appointment_id',data.appointmentId).maybeSingle()]);
 if(a.error||c.error||m.error||settled.error)throw new Error('Afrekenen kon niet worden geladen.');
 // Reception may read amounts, never the medical note, answers or diagnoses.
 const {admin}=await import('./booking.server');const privileged=await admin();
 const note=await privileged.from('consult_notes').select('step_data').eq('tenant_id',a.data.tenant_id).eq('appointment_id',a.data.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(note.error)throw new Error('Betaalregels konden niet worden geladen.');
 const steps=readStepData(note.data?.step_data);
 const source=steps.lines.length?steps.lines:c.data.filter(t=>t.id===a.data.treatment_id).map(t=>({treatmentId:t.id,name:t.name_nl,qty:1,unit:t.price_per??'',priceCents:t.price_cents??0}));
 const catalog=c.data.map(t=>({...t,effectiveVatRate:t.vat_exemption_possible&&steps.vat?.exempt&&steps.vat.by&&steps.vat.at?0:Number(t.btw_rate??0)}));
 const lines=source.map(l=>({treatmentId:l.treatmentId,name:l.name,qty:l.qty,unit:l.unit,priceCents:l.priceCents,discountCents:0,vatRate:catalog.find(t=>t.id===l.treatmentId)?.effectiveVatRate??0}));
 return {lines,catalog,methods:m.data,settlement:settled.data};
});
export const settleBilling=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(settlementSchema).handler(async({data,context})=>{
 if(!(await context.supabase.rpc('is_aal2')).data||!(await context.supabase.rpc('has_permission',{_perm:'billing.till'})).data)throw new Error('Geen toegang.');
 const d=validateSettlement(data);
 if(!d.withoutInvoice){const active=await context.supabase.rpc('current_tenant');if(!active.data)throw new Error('Geen actieve kliniek.');const t=await context.supabase.from('tenants').select('test_mode').eq('id',active.data).single();if(!t.data?.test_mode)throw new Error('Betalen is alleen beschikbaar in de demo.');if(!(await mockBillingPaymentProvider.pay(d.payments)).paid)throw new Error('Betaling niet gelukt.');}
 const r=await context.supabase.rpc('settle_appointment',{_appointment:d.appointmentId,_lines:d.lines as unknown as Json,_payments:d.payments as Json,_without_invoice:d.withoutInvoice,_reason:d.reason});
 if(r.error)throw new Error(r.error.message);return {id:r.data};
});
export const readPatientInvoice=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator(z.object({appointmentId:z.string().uuid()})).handler(async({data,context})=>{
 const pid=await context.supabase.rpc('portal_patient_id');if(!pid.data)throw new Error('Log in als patiënt.');
 const r=await context.supabase.from('billing_settlements').select('*').eq('appointment_id',data.appointmentId).eq('patient_id',pid.data).eq('without_invoice',false).maybeSingle();if(r.error)throw new Error('Factuur kon niet worden geladen.');return r.data;
});