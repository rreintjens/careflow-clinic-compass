import {createServerFn} from "@tanstack/react-start";
import {requireSupabaseAuth} from "@/integrations/supabase/auth-middleware";
import {patientDetailsSchema} from "@/domain/patient-details";
async function ownPatient(context:{supabase:import("@supabase/supabase-js").SupabaseClient}){
 const {data:pid,error}=await context.supabase.rpc("portal_patient_id");if(error||!pid)throw new Error("Log in als patiënt.");
 const row=await context.supabase.from("patients").select("id,tenant_id").eq("id",pid).single();if(row.error)throw new Error("Je gegevens zijn niet beschikbaar.");return row.data as {id:string;tenant_id:string};
}
export const readPatientDetails=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const p=await ownPatient(context);const r=await context.supabase.from("patients").select("date_of_birth,phone,postcode,house_number,house_suffix,street,city").eq("id",p.id).eq("tenant_id",p.tenant_id).single();if(r.error)throw new Error("Je gegevens zijn niet beschikbaar.");return r.data;
});
export const savePatientDetails=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(patientDetailsSchema).handler(async({data,context})=>{
 const p=await ownPatient(context);const {admin}=await import("./booking.server");const db=await admin();
 const r=await db.from("patients").update({...data,postcode:data.postcode.toUpperCase(),house_suffix:data.house_suffix||null,updated_by:context.userId}).eq("id",p.id).eq("tenant_id",p.tenant_id).select("id");if(r.error||!r.data?.length)throw new Error("Opslaan is niet gelukt.");
 const audit=await db.from("audit_log").insert({tenant_id:p.tenant_id,user_id:context.userId,role_key:"patient",action:"patient_updated",category:"patient",record_type:"patients",record_id:p.id});if(audit.error)throw new Error("Opslaan kon niet worden geregistreerd.");return {ok:true};
});