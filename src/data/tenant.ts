import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Memberships of the signed-in user; `active` marks the tenant in the session claim. */
export const myTenantsQuery = queryOptions({
  queryKey: ["my-tenants"],
  queryFn: async () => {
    const { data, error } = await supabase.rpc("my_tenants");
    if (error) throw error;
    return data ?? [];
  },
  staleTime: 60_000,
});

let bucketCache: Promise<string> | null = null;
/** Storage buckets are per tenant: `practitioner-photos-<slug>`. */
export function practitionerPhotoBucket(): Promise<string> {
  if (!bucketCache) {
    bucketCache = (async () => {
      const { data, error } = await supabase.rpc("current_tenant_slug");
      if (error || !data) {
        bucketCache = null;
        throw error ?? new Error("Geen actieve organisatie");
      }
      return `practitioner-photos-${data}`;
    })();
  }
  return bucketCache;
}
export function resetTenantCaches() {
  bucketCache = null;
}
