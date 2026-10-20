import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
export const appointmentStatusOptionsQuery = queryOptions({ queryKey: ["appointment-status-options"], queryFn: async () => {
  const r = await supabase.from("option_lists").select("list_key,value,label_nl").in("list_key", ["appointment_status", "cancel_reason", "appointment_kind"]).order("sort");
  if (r.error) throw r.error; return r.data;
} });
export const appointmentHistoryQuery = (id: string) => queryOptions({ queryKey: ["appointment-status-history", id], queryFn: async () => {
  const r = await supabase.from("appointment_status_history").select("id,from_status,to_status,created_at,changed_by,reason,note").eq("appointment_id", id).order("created_at", { ascending: false });
  if (r.error) throw r.error;
  const ids = [...new Set(r.data.map(h => h.changed_by).filter((x): x is string => !!x))];
  const users = ids.length ? await supabase.rpc("staff_names", { _ids: ids }) : { data: [], error: null };
  if (users.error) throw users.error;
  return r.data.map(h => ({ ...h, author: users.data?.find(u => u.id === h.changed_by)?.full_name ?? "" }));
} });
export const receptionTasksQuery = queryOptions({ queryKey: ["reception-tasks"], queryFn: async () => {
  const [notes, waitlist] = await Promise.all([
    supabase.from("consult_notes").select("id,appointment_id,patient:patients(patient_number,first_name,last_name)").in("status", ["draft", "parked"]).not("appointment_id", "is", null),
    supabase.from("waitlist_entries").select("id,note,treatment_id,patient:patients(id,patient_number,first_name,last_name)").eq("status", "open"),
  ]);
  if (waitlist.error) throw waitlist.error;
  // Medical rows are deliberately absent for reception roles without medical access.
  return { notes: notes.error ? [] : notes.data, waitlist: waitlist.data };
} });
export const appointmentSmsQuery=(id:string)=>queryOptions({queryKey:["appointment-sms",id],queryFn:async()=>{const r=await supabase.from("sms_outbox").select("id,moment,status,created_at").eq("appointment_id",id).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data;}});
export const appointmentFeesQuery=(id:string)=>queryOptions({queryKey:["appointment-fees",id],queryFn:async()=>{const r=await supabase.from("appointment_fee_requests").select("id,amount_cents,status,demo_token").eq("appointment_id",id).order("created_at",{ascending:false});if(r.error)throw r.error;return r.data;}});