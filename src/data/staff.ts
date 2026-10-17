import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const staffContextQuery = queryOptions({
  queryKey: ["staff-context"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_staff_context");
    if (error) throw error;
    return data?.[0] ?? null;
  },
  staleTime: 60_000,
});

export const appFlagsQuery = queryOptions({
  queryKey: ["app-flags"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("public_app_flags");
    if (error) throw error;
    return data?.[0] ?? null;
  },
  staleTime: 5 * 60_000,
});
