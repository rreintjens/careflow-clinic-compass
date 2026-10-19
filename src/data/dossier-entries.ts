import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { entryOptions } from "./dossier-entries.functions";
export const entryOptionsQuery=queryOptions({queryKey:["dossier-entry-options"],queryFn:()=>entryOptions()});
export const dossierEntriesQuery=(patientId:string)=>queryOptions({queryKey:["dossier-entries",patientId],enabled:!!patientId,queryFn:async()=>{
 const [contacts,requests]=await Promise.all([supabase.from("patient_contacts").select("*").eq("patient_id",patientId).order("occurred_at",{ascending:false}),supabase.from("patient_requests").select("*").eq("patient_id",patientId).order("created_at",{ascending:false})]);
 if(contacts.error||requests.error)throw new Error("Laden is niet gelukt");
 const ids=[...new Set([...(contacts.data??[]),...(requests.data??[])].flatMap(x=>[x.created_by,x.updated_by]).filter((x):x is string=>!!x))];
 const names=await supabase.rpc("staff_names",{_ids:ids});return {contacts:contacts.data??[],requests:requests.data??[],names:Object.fromEntries((names.data??[]).map(x=>[x.id,x.full_name]))};
}});
export type Entries=Awaited<ReturnType<NonNullable<ReturnType<typeof dossierEntriesQuery>["queryFn"]>>>;
export const followUpsQuery=queryOptions({queryKey:["follow-ups"],queryFn:async()=>{
 const user=await supabase.auth.getUser();if(!user.data.user)return [];
 const r=await supabase.from("patient_contacts").select("*,patient:patients(patient_number,first_name,last_name)").eq("assigned_to",user.data.user.id).eq("done",false).not("follow_up","is",null).order("due_on");if(r.error)throw r.error;return r.data;
}});