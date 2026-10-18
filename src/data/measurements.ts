import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const measurementsQuery = (patientId: string) => queryOptions({
  queryKey: ["measurements", patientId],
  queryFn: async () => {
    const result = await supabase.from("measurements").select("*").eq("patient_id", patientId).order("measured_on").order("created_at");
    if (result.error) throw result.error;
    return result.data;
  },
});