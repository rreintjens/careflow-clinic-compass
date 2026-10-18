/**
 * Meeting links for booked appointments. Behind one interface: in test mode a mock creates the
 * same link without touching Google. The link lives on the appointment row, so rescheduling and
 * every screen that reads the row (Mijn dag, dossier, patiëntkaart, mails) show the same one.
 */
import { meetingProvider, needsMeeting, type Meeting } from "@/domain/meet";

import { admin, type Tenant } from "./booking.server";

type Supabase = import("@supabase/supabase-js").SupabaseClient;

/** Creates the link for an online appointment once, then never again. Returns the link or null. */
export async function attachMeeting(db: Supabase, tenant: Tenant, appointmentId: string): Promise<Meeting | null> {
  const appt = (await db.from("appointments").select("id, starts_at, ends_at, meet_link, location_id, treatment_id, practitioner_id, patient:patients(first_name, last_name)")
    .eq("tenant_id", tenant.id).eq("id", appointmentId).maybeSingle()).data;
  if (!appt) return null;
  if (appt.meet_link) return { link: appt.meet_link, calendarId: "", created_at: "" };
  const location = (await db.from("locations").select("kind").eq("tenant_id", tenant.id).eq("id", appt.location_id).maybeSingle()).data;
  if (!needsMeeting(location?.kind)) return null;
  const treatment = (await db.from("treatments").select("name_nl").eq("tenant_id", tenant.id).eq("id", appt.treatment_id).maybeSingle()).data;
  const practitioner = (await db.from("practitioners").select("email").eq("tenant_id", tenant.id).eq("id", appt.practitioner_id).maybeSingle()).data;
  const provider = meetingProvider(tenant.google_meet_account ?? "agenda@bodyclinic.nl", !tenant.test_mode);
  const patient = appt.patient as { first_name?: string; last_name?: string } | null;
  const meeting = await provider.create({
    appointmentId: appt.id,
    title: `${treatment?.name_nl ?? "Afspraak"} · ${tenant.display_name}`,
    startsAt: appt.starts_at,
    endsAt: appt.ends_at,
    patientName: [patient?.first_name, patient?.last_name].filter(Boolean).join(" "),
    practitionerEmail: practitioner?.email ?? null,
    timeZone: tenant.time_zone,
  });
  await db.from("appointments").update({ meet_link: meeting.link, meet_link_created_at: meeting.created_at }).eq("tenant_id", tenant.id).eq("id", appt.id);
  return meeting;
}

/** Same helper for the staff path, which already knows the tenant through its own lookup. */
export async function attachMeetingForStaff(tenant: Tenant, appointmentId: string) {
  return attachMeeting(await admin(), tenant, appointmentId);
}
