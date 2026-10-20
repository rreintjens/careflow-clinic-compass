import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
import {cancelPolicy} from "@/domain/mail";
import {cancellationFee,mockFeePaymentProvider} from "@/domain/appointment-fees";
export const requestCancellationFee=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({appointmentId:z.string().uuid()}))
 .handler(async({data,context})=>{
  const db=context.supabase;if(!(await db.rpc("is_aal2")).data||!(await db.rpc("has_permission",{_perm:"billing.till"})).data)throw new Error("Geen toegang.");
  const a=await db.from("appointments").select("id,status,starts_at,treatment_id,tenant_id").eq("id",data.appointmentId).single();if(a.error)throw new Error(a.error.message);
  const [t,links,settings]=await Promise.all([db.from("treatments").select("cancel_until_hours,no_show_fee_eur").eq("id",a.data.treatment_id).single(),db.from("treatment_category_links").select("category_id").eq("treatment_id",a.data.treatment_id),db.from("settings").select("key,value").in("key",["cancel_until_hours","no_show_amount_cents"])]);
  if(t.error||links.error||settings.error)throw new Error("De annuleringsvoorwaarden zijn niet beschikbaar.");
  const direct=links.data.map(l=>l.category_id);const cats=direct.length?await db.from("treatment_categories").select("id,parent_id,cancel_until_hours,no_show_fee_eur").in("id",direct):{data:[]};
  const parents=(cats.data??[]).flatMap(c=>c.parent_id?[c.parent_id]:[]);const parentRows=parents.length?await db.from("treatment_categories").select("cancel_until_hours,no_show_fee_eur").in("id",parents):{data:[]};
  const category=[...(cats.data??[]),...(parentRows.data??[])].find(c=>c.cancel_until_hours!==null||c.no_show_fee_eur!==null);
  const get=(key:string)=>Number(settings.data.find(s=>s.key===key)?.value??0);
  const amount=cancellationFee(a.data.status,a.data.starts_at,Date.now(),cancelPolicy(t.data,category,{cancelHours:get("cancel_until_hours"),noShowCents:get("no_show_amount_cents")}));
  if(!amount)throw new Error("Volgens de ingestelde voorwaarden zijn er geen kosten.");
  const prior=await db.from("appointment_fee_requests").select("id").eq("appointment_id",a.data.id).in("status",["open","paid"]).limit(1);if(prior.data?.length)throw new Error("Er bestaat al een betaalverzoek voor deze afspraak.");
  const r=await db.from("appointment_fee_requests").insert({appointment_id:a.data.id,amount_cents:amount}).select("id").single();if(r.error)throw new Error(r.error.message);return r.data;
 });
export const getDemoFee=createServerFn({method:"POST"}).inputValidator(z.object({token:z.string().uuid()})).handler(async({data})=>{
 const {admin}=await import("./booking.server");const db=await admin();const r=await db.from("appointment_fee_requests").select("id,amount_cents,status,tenant_id").eq("demo_token",data.token).maybeSingle();if(!r.data)return null;
 const tenant=await db.from("tenants").select("test_mode").eq("id",r.data.tenant_id).single();if(!tenant.data?.test_mode)return null;return {amountCents:r.data.amount_cents,status:r.data.status};
});
export const payDemoFee=createServerFn({method:"POST"}).inputValidator(z.object({token:z.string().uuid()})).handler(async({data})=>{
 const {admin}=await import("./booking.server");const db=await admin();const r=await db.from("appointment_fee_requests").select("id,status,tenant_id").eq("demo_token",data.token).maybeSingle();if(!r.data)throw new Error("Ongeldige link.");
 const tenant=await db.from("tenants").select("test_mode").eq("id",r.data.tenant_id).single();if(!tenant.data?.test_mode)throw new Error("Alleen beschikbaar in de demo.");
 if(r.data.status!=="open")throw new Error("Dit betaalverzoek is niet meer open.");
 const result=await mockFeePaymentProvider.pay(r.data.id);if(!result.paid)throw new Error("Betaling niet gelukt.");
 const update=await db.from("appointment_fee_requests").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",r.data.id).eq("status","open").select("id");if(update.error||!update.data?.length)throw new Error("Dit betaalverzoek is inmiddels gewijzigd.");return {ok:true};
});