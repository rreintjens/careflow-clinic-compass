import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { contactSchema, requestSchema } from "@/domain/dossier-entries";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const entryOptions = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async ({context}) => {
 const db=context.supabase;
 const [opts,members,doctors]=await Promise.all([db.from("option_lists").select("list_key,value,label_nl").in("list_key",["dossier_entry_ui","contact_kind","contact_direction","request_kind","request_duration","request_destination","request_status"]).order("sort"), db.from("tenant_memberships").select("user_id").eq("active",true),db.from("practitioners").select("id,first_name,last_name").eq("status","active")]);
 if(opts.error || members.error || doctors.error) throw new Error("Laden is niet gelukt");
 const names=await db.rpc("staff_names",{_ids:(members.data??[]).map(x=>x.user_id)});
 return {options:opts.data??[],staff:(names.data??[]).map(x=>({...x,full_name:x.id===context.userId?`${x.full_name} (jij)`:x.full_name})),doctors:doctors.data??[]};
});
async function permitted(context: {supabase: import("@supabase/supabase-js").SupabaseClient}) {
 if(!(await context.supabase.rpc("has_permission",{_perm:"patients.edit"})).data || !(await context.supabase.rpc("is_aal2")).data) throw new Error("Je hebt geen toegang tot deze actie");
}
export const saveContact=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>contactSchema.parse(v)).handler(async ({data,context})=>{
 await permitted(context);
 if(data.assignedTo) { const m=await context.supabase.from("tenant_memberships").select("user_id").eq("user_id",data.assignedTo).eq("active",true).maybeSingle(); if(!m.data) throw new Error("Kies een actieve medewerker"); }
 const row={patient_id:data.patientId,kind:data.kind,direction:data.kind==="internal"?null:data.direction,subject:data.subject,body:data.body,occurred_at:data.occurredAt,follow_up:data.followUp,assigned_to:data.assignedTo,due_on:data.dueOn};
 const r=data.id?await context.supabase.from("patient_contacts").update(row).eq("id",data.id).eq("patient_id",data.patientId).select("id").single():await context.supabase.from("patient_contacts").insert(row).select("id").single();
 if(r.error) throw new Error("Opslaan is niet gelukt"); return r.data;
});
export const saveRequest=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>requestSchema.parse(v)).handler(async ({data,context})=>{
 await permitted(context);
 if(data.practitionerId) {const p=await context.supabase.from("practitioners").select("id").eq("id",data.practitionerId).eq("status","active").maybeSingle();if(!p.data)throw new Error("Kies een actieve arts");}
 const row={patient_id:data.patientId,kind:data.kind,duration_months:data.kind==="package"?data.durationMonths:null,explanation:data.explanation,destination:data.destination,practitioner_id:data.destination==="doctor"?data.practitionerId:null,status:data.status};
 const r=data.id?await context.supabase.from("patient_requests").update(row).eq("id",data.id).eq("patient_id",data.patientId).select("id").single():await context.supabase.from("patient_requests").insert(row).select("id").single();
 if(r.error) throw new Error("Opslaan is niet gelukt");return r.data;
});
export const completeFollowUp=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator(z.object({id:z.string().uuid(),done:z.boolean()})).handler(async ({data,context})=>{
 await permitted(context);const r=await context.supabase.from("patient_contacts").update({done:data.done}).eq("id",data.id);if(r.error)throw new Error("Opslaan is niet gelukt");
});