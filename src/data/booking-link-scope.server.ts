import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { scopePractitioners, scopeTreatments, type LinkCatalog, type LinkScope } from "@/domain/booking-links";

export async function scopeCatalog(db: SupabaseClient<Database>, tenantId: string): Promise<LinkCatalog> {
  const [treatments, categories, links, locations, offers, people, works, does, mixed] = await Promise.all([
    db.from("treatments").select("id").eq("tenant_id", tenantId).eq("status", "active"),
    db.from("treatment_categories").select("id,parent_id").eq("tenant_id", tenantId),
    db.from("treatment_category_links").select("treatment_id,category_id").eq("tenant_id", tenantId),
    db.from("locations").select("id,kind").eq("tenant_id", tenantId).eq("status", "open"),
    db.from("treatment_locations").select("treatment_id,location_id").eq("tenant_id", tenantId),
    db.from("practitioners").select("id").eq("tenant_id", tenantId).eq("status", "active"),
    db.from("practitioner_locations").select("practitioner_id,location_id").eq("tenant_id", tenantId),
    db.from("practitioner_treatments").select("practitioner_id,treatment_id,excluded_location_ids").eq("tenant_id", tenantId),
    db.from("schedule_blocks").select("practitioner_id,location_id").eq("tenant_id", tenantId).eq("allows_online", true),
  ]);
  for (const result of [treatments,categories,links,locations,offers,people,works,does,mixed]) if (result.error) throw new Error("Keuzes laden is niet gelukt");
  const open = new Set(locations.data?.map(l => l.id));
  const online = locations.data?.filter(l => l.kind === "online").map(l => l.id) ?? [];
  return {
    categories: categories.data ?? [],
    treatments: (treatments.data ?? []).map(t => ({id:t.id,locations:(offers.data ?? []).filter(l => l.treatment_id === t.id && open.has(l.location_id)).map(l => l.location_id),categories:(links.data ?? []).filter(l => l.treatment_id === t.id).map(l => l.category_id)})),
    practitioners: (people.data ?? []).map(p => ({id:p.id,treatments:(does.data ?? []).filter(t => t.practitioner_id === p.id).map(t => t.treatment_id),locations:[...(works.data ?? []).filter(l => l.practitioner_id === p.id && open.has(l.location_id)).map(l => l.location_id),...(mixed.data?.some(b => b.practitioner_id === p.id && locations.data?.some(l => l.id===b.location_id && l.kind === "clinic")) ? online : [])],exclusions:(does.data ?? []).filter(t => t.practitioner_id === p.id)})),
  };
}

export async function resolveLinkScope(db: SupabaseClient<Database>, tenantId: string, code: string) {
  if (!/^[a-z0-9-]{2,60}$/.test(code)) return null;
  const result = await db.from("booking_links").select("*").eq("tenant_id",tenantId).or(`slug.eq.${code},hash.eq.${code}`).eq("status","active").maybeSingle();
  if (result.error || !result.data) return null;
  const row = result.data;
  const catalog = await scopeCatalog(db,tenantId);
  const draft: LinkScope = {...row,treatment_id:null,practitioner_id:null,practitioner_scope:row.practitioner_scope === "selected" ? "selected" : "all"};
  const treatmentIds = scopeTreatments(catalog,draft).filter(id => scopePractitioners(catalog,draft,id).length > 0);
  return { row,catalog,draft,treatmentIds };
}