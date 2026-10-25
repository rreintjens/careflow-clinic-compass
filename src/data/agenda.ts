import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { agendaStatuses } from "@/domain/appointment-status";
import { orgQuery, type Org } from "./organisation";
import { getOrganisation } from "./organisation-read.functions";

function must<D>(r: { data: D | null; error: unknown }): D {
  if (r.error) throw r.error;
  return r.data as D;
}

/** Reference data for the agenda (practitioners, schedules, catalogue); RLS scopes to the active tenant. */
export async function loadAgendaRef(organisation: Promise<Org> = getOrganisation()) {
  {
    const [org, blocks, exc] = await Promise.all([
      organisation,
      supabase.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids, allows_online"),
      supabase.from("schedule_exceptions").select("practitioner_id, kind, date_from, date_to, starts, ends, location_id"),
    ]);
    return {
      practitioners: org.practitioners.filter(p => p.status === "active").sort((a, b) => a.first_name.localeCompare(b.first_name, "nl")), blocks: must(blocks), exceptions: must(exc), locations: org.locations,
      treatments: org.treatments.filter(t => t.status === "active"), categories: org.categories, links: org.categoryLinks, pracTreat: org.practitionerTreatments, pracLoc: org.practitionerLocations, treatLoc: org.treatmentLocations, options: org.options.filter(o => ["agenda_notify", "agenda_reason", "mail_moment"].includes(o.list_key)),
    };
  }
}
export type AgendaRef = Awaited<ReturnType<typeof loadAgendaRef>>;
export const agendaRefQuery = queryOptions({ queryKey: ["agenda-ref"], queryFn: ({ client }) => loadAgendaRef(client.fetchQuery(orgQuery)), staleTime: 60_000 });

/** Booked appointments between two UTC instants. */
export async function loadAgendaAppts(from: string, to: string) {
  return must(await supabase.from("appointments")
    .select("id, starts_at, ends_at, status, practitioner_id, location_id, treatment_id, room_id, equipment_ids, kind, notify, notification_plan, booking_reason, reception_note, cancel_reason, meet_link, source, booking_attribution, new_patient, referral_source, addon, patient:patients(id, patient_number, first_name, last_name, date_of_birth, phone)")
    .in("status", [...agendaStatuses, "cancelled"]).gte("starts_at", from).lt("starts_at", to));
}
export type AgendaAppt = Awaited<ReturnType<typeof loadAgendaAppts>>[number];
export const agendaApptsQuery = (from: string, to: string) => queryOptions({ queryKey: ["agenda-appts", from, to], queryFn: () => loadAgendaAppts(from, to), staleTime: 30_000 });

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
