import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Booking links for the beheer screen. RLS decides who sees them (booking_links.view);
 * the tenant is already fixed by the active membership.
 */
export const bookingLinksQuery = queryOptions({
  queryKey: ["booking-links"],
  queryFn: async () => {
    const [links, treatments, locations, practitioners, options] = await Promise.all([
      supabase.from("booking_links").select("*").order("sort").order("created_at"),
      supabase.from("treatments").select("id, name_nl, name_en, duration_min, practitioner_choice, status").eq("status", "active").order("name_nl"),
      supabase.from("locations").select("id, name, kind, address, status, sort").order("sort"),
      supabase.from("practitioners").select("id, first_name, last_name, role_id, status").eq("status", "active").order("last_name"),
      supabase.from("option_lists").select("list_key, value, label_nl, label_en").in("list_key", ["practitioner_choice", "booking_link_ui"]).order("sort"),
    ]);
    if (links.error) throw links.error;
    if (treatments.error) throw treatments.error;
    if (locations.error) throw locations.error;
    if (practitioners.error) throw practitioners.error;
    if (options.error) throw options.error;
    return { links: links.data, treatments: treatments.data, locations: locations.data, practitioners: practitioners.data, options: options.data };
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
