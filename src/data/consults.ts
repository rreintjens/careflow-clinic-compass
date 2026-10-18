import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const standaloneConsultOptionsQuery = queryOptions({
  queryKey: ["standalone-consult-options"],
  queryFn: async () => {
    const [practitioners, options] = await Promise.all([
      supabase.from("practitioners").select("id, first_name, last_name").eq("status", "active").order("first_name"),
      supabase.from("option_lists").select("list_key, value, label_nl").in("list_key", ["standalone_consult_kind", "standalone_consult_follow_up", "standalone_consult_visibility"]).order("sort"),
    ]);
    if (practitioners.error) throw practitioners.error;
    if (options.error) throw options.error;
    return { practitioners: practitioners.data, options: options.data };
  },
});

export const standaloneConsultsQuery = (patientId: string) => queryOptions({
  queryKey: ["standalone-consults", patientId],
  queryFn: async () => {
    const result = await supabase.from("consult_notes").select("*, practitioner:practitioners(first_name, last_name)")
      .eq("patient_id", patientId).is("appointment_id", null).eq("status", "final").order("occurred_at", { ascending: false });
    if (result.error) throw result.error;
    return result.data;
  },
});