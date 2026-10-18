import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Booking links for the beheer screen, plus everything the form needs to show what a link does:
 * which locations offer a treatment, and what each practitioner does there. RLS decides who sees
 * them (booking_links.view); the tenant is already fixed by the active membership.
 */
export const bookingLinksQuery = queryOptions({
  queryKey: ["booking-links"],
  queryFn: async () => {
    const tenantId = (await supabase.rpc("current_tenant")).data as string | null;
    const [links, treatments, locations, practitioners, options, treatLoc, pracLoc, pracTreat, tenant] = await Promise.all([
      supabase.from("booking_links").select("*").order("sort").order("created_at"),
      supabase.from("treatments").select("id, name_nl, name_en, duration_min, practitioner_choice, status").eq("status", "active").order("name_nl"),
      supabase.from("locations").select("id, name, kind, address, status, sort").order("sort"),
      supabase.from("practitioners").select("id, first_name, last_name, role_id, status").eq("status", "active").order("last_name"),
      supabase.from("option_lists").select("list_key, value, label_nl, label_en").in("list_key", ["practitioner_choice"]).order("sort"),
      supabase.from("treatment_locations").select("treatment_id, location_id"),
      supabase.from("practitioner_locations").select("practitioner_id, location_id"),
      supabase.from("practitioner_treatments").select("practitioner_id, treatment_id"),
      tenantId
        ? supabase.from("tenants").select("slug, display_name, booking_domains, test_mode").eq("id", tenantId).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    if (links.error) throw links.error;
    if (treatments.error) throw treatments.error;
    if (locations.error) throw locations.error;
    if (practitioners.error) throw practitioners.error;
    if (options.error) throw options.error;
    if (treatLoc.error) throw treatLoc.error;
    if (pracLoc.error) throw pracLoc.error;
    if (pracTreat.error) throw pracTreat.error;
    return {
      links: links.data,
      treatments: treatments.data,
      locations: locations.data,
      practitioners: practitioners.data,
      options: options.data,
      treatmentLocations: treatLoc.data,
      practitionerLocations: pracLoc.data,
      practitionerTreatments: pracTreat.data,
      tenant: tenant.data,
    };
  },
});
export type BookingLinksData = Awaited<ReturnType<NonNullable<typeof bookingLinksQuery.queryFn>>>;

/** Bookings per link over the last 30 days, for the "hoe gebruikt" column. */
export const bookingLinkUsageQuery = queryOptions({
  queryKey: ["booking-link-usage"],
  queryFn: async () => {
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const { data, error } = await supabase.from("appointments").select("booking_link_id, created_at").not("booking_link_id", "is", null).gte("created_at", since);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      if (!row.booking_link_id) continue;
      counts.set(row.booking_link_id, (counts.get(row.booking_link_id) ?? 0) + 1);
    }
    return counts;
  },
});
