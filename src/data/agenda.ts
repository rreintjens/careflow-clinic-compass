import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

function must<D>(r: { data: D | null; error: unknown }): D {
  if (r.error) throw r.error;
  return r.data as D;
}

/** Day agenda for the active tenant (RLS scopes to tenant + permission). `from`/`to` are UTC ISO bounds. */
export const agendaQuery = (date: string, from: string, to: string) => queryOptions({
  queryKey: ["agenda", date],
  queryFn: async () => {
    const [prac, blocks, exc, appts, locs, treats] = await Promise.all([
      supabase.from("practitioners").select("id, first_name, last_name, photo_path, status").eq("status", "active"),
      supabase.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids"),
      supabase.from("schedule_exceptions").select("practitioner_id, kind, date_from, date_to, starts, ends, location_id").lte("date_from", date),
      supabase.from("appointments").select("id, starts_at, ends_at, status, practitioner_id, location_id, treatment_id, meet_link, source, new_patient, referral_source, patient:patients(id, patient_number, first_name, last_name, date_of_birth, phone)")
        .in("status", ["booked"]).gte("starts_at", from).lt("starts_at", to),
      supabase.from("locations").select("id, name, kind"),
      supabase.from("treatments").select("id, name_nl"),
    ]);
    return { practitioners: must(prac), blocks: must(blocks), exceptions: must(exc), appointments: must(appts), locations: must(locs), treatments: must(treats) };
  },
});
