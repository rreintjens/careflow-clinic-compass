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

/** The active tenant's own settings, shown on Instellingen > Algemeen; only group admins may edit. */
export const currentTenantQuery = queryOptions({
  queryKey: ["current-tenant"],
  queryFn: async () => {
    const { data: id, error } = await supabase.rpc("current_tenant");
    if (error || !id) throw error ?? new Error("Geen actieve organisatie");
    const t = await supabase.from("tenants").select("id, slug, display_name, country, time_zone, booking_domains, test_mode").eq("id", id).single();
    if (t.error) throw t.error;
    const ga = await supabase.rpc("is_group_admin");
    return { ...t.data, canEdit: !ga.error && !!ga.data };
  },
  staleTime: 60_000,
});

export async function saveTenant(id: string, row: { display_name: string; country: string; time_zone: string; booking_domains: string[]; test_mode: boolean }) {
  const { error } = await supabase.from("tenants").update(row).eq("id", id);
  if (error) throw error;
}
