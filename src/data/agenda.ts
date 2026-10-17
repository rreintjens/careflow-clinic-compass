import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

function must<D>(r: { data: D | null; error: unknown }): D {
  if (r.error) throw r.error;
  return r.data as D;
}

/** Reference data for the agenda (practitioners, schedules, catalogue); RLS scopes to the active tenant. */
export async function loadAgendaRef() {
  {
    const [prac, blocks, exc, locs, treats, cats, links, pt, pl, tl, opts] = await Promise.all([
      supabase.from("practitioners").select("id, first_name, last_name, photo_path, status").eq("status", "active"),
      supabase.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids"),
      supabase.from("schedule_exceptions").select("practitioner_id, kind, date_from, date_to, starts, ends, location_id"),
      supabase.from("locations").select("id, name, kind").order("sort"),
      supabase.from("treatments").select("id, name_nl, duration_min, status").eq("status", "active").order("name_nl"),
      supabase.from("treatment_categories").select("id, parent_id, name_nl, sort").order("sort"),
      supabase.from("treatment_category_links").select("treatment_id, category_id"),
      supabase.from("practitioner_treatments").select("practitioner_id, treatment_id, excluded_location_ids"),
      supabase.from("practitioner_locations").select("practitioner_id, location_id"),
      supabase.from("treatment_locations").select("treatment_id, location_id"),
      supabase.from("option_lists").select("list_key, value, label_nl").in("list_key", ["agenda_notify", "agenda_reason"]).order("sort"),
    ]);
    return {
      practitioners: must(prac).sort((a, b) => a.first_name.localeCompare(b.first_name, "nl")), blocks: must(blocks), exceptions: must(exc), locations: must(locs),
      treatments: must(treats), categories: must(cats), links: must(links), pracTreat: must(pt), pracLoc: must(pl), treatLoc: must(tl), options: must(opts),
    };
  }
}
export type AgendaRef = Awaited<ReturnType<typeof loadAgendaRef>>;
export const agendaRefQuery = queryOptions({ queryKey: ["agenda-ref"], queryFn: loadAgendaRef, staleTime: 60_000 });

/** Booked appointments between two UTC instants. */
export async function loadAgendaAppts(from: string, to: string) {
  return must(await supabase.from("appointments")
    .select("id, starts_at, ends_at, status, practitioner_id, location_id, treatment_id, meet_link, source, new_patient, referral_source, patient:patients(id, patient_number, first_name, last_name, date_of_birth, phone)")
    .eq("status", "booked").gte("starts_at", from).lt("starts_at", to));
}
export type AgendaAppt = Awaited<ReturnType<typeof loadAgendaAppts>>[number];
export const agendaApptsQuery = (from: string, to: string) => queryOptions({ queryKey: ["agenda-appts", from, to], queryFn: () => loadAgendaAppts(from, to) });

/** Patient search for "Voor wie" (number, name or e-mail). */
export const patientSearchQuery = (q: string) => queryOptions({
  queryKey: ["patient-search", q],
  enabled: q.trim().length >= 2,
  queryFn: async () => {
    const t = q.trim().replace(/[%,()]/g, "");
    const num = /^\d+$/.test(t) ? `,patient_number.eq.${t}` : "";
    return must(await supabase.from("patients").select("id, patient_number, first_name, last_name, date_of_birth")
      .is("deleted_at", null).or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,email.ilike.%${t}%${num}`).limit(6));
  },
});
