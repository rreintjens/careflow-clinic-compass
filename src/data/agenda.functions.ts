/** Staff scheduling from the agenda. Caller must be aal2 with agenda.appointments in the active tenant. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, computeSlots, localParts, localToUtc } from "./booking.server";
import { attachMeeting } from "./meeting.server";
import { safeQueue } from "./mailer.server";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; claims: unknown };

async function staffTenant(context: Ctx) {
  const claims = context.claims as { aal?: string; app_metadata?: { active_tenant?: string } };
  if (!(await context.supabase.rpc("is_aal2")).data || !claims.app_metadata?.active_tenant) return null;
  const { data: ok } = await context.supabase.rpc("has_permission", { _perm: "agenda.appointments" });
  if (!ok) return null;
  const db = await admin();
  const t = (await db.from("tenants").select("id, slug, display_name, time_zone, default_language, extra_languages, test_mode, booking_domains, google_meet_account, mail_sender, mail_sender_verified, ekis_export_enabled, stats_key_hash").eq("id", claims.app_metadata.active_tenant).single()).data;
  return t;
}

export const getStaffSlots = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ treatmentId: z.string().uuid(), locationId: z.string().uuid(), practitionerId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const tenant = await staffTenant(context as unknown as Ctx);
    if (!tenant) return [];
    const from = localParts(new Date(), tenant.time_zone).date;
    const r = await computeSlots(tenant, { treatmentId: data.treatmentId, locationId: data.locationId, practitionerIds: [data.practitionerId], from, days: 28 });
    return (r.perPractitioner[data.practitionerId] ?? []).slice(0, 3).map((s) => ({ date: s.date, start: s.start }));
  });

export const createStaffAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    patientId: z.string().uuid(), treatmentId: z.string().uuid(), locationId: z.string().uuid(), practitionerId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int().min(0).max(1439), notify: z.string().max(40), reason: z.string().max(40).nullable(),
  }))
  .handler(async ({ data, context }) => {
    const tenant = await staffTenant(context as unknown as Ctx);
    if (!tenant) return { ok: false as const, reason: "forbidden" };
    const r = await computeSlots(tenant, { treatmentId: data.treatmentId, locationId: data.locationId, practitionerIds: [data.practitionerId], from: data.date, days: 1 });
    if (!(r.perPractitioner[data.practitionerId] ?? []).some((s) => s.date === data.date && s.start === data.start)) return { ok: false as const, reason: "taken" };
    const db = await admin();
    const t = (await db.from("treatments").select("duration_min").eq("id", data.treatmentId).single()).data;
    const startsAt = localToUtc(data.date, data.start, tenant.time_zone);
    // Insert as the signed-in user, so RLS (tenant + permission) and the audit trigger apply.
    const ins = await (context as unknown as Ctx).supabase.from("appointments").insert({
      patient_id: data.patientId, treatment_id: data.treatmentId, location_id: data.locationId, practitioner_id: data.practitionerId,
      starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + (t?.duration_min ?? 30) * 60_000).toISOString(),
      status: "booked", source: "agenda", notify: data.notify, booking_reason: data.reason, new_patient: false,
    }).select("id").single();
    if (ins.error) return { ok: false as const, reason: "failed" };
    await attachMeeting(db, tenant, (ins.data as { id: string }).id);
    await safeQueue(db, (ins.data as { id: string }).id, "confirmation", { dedupe: `confirmation-${(ins.data as { id: string }).id}` });
    return { ok: true as const, id: (ins.data as { id: string }).id };
  });

const newPatientSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(30).regex(/^[+\d\s()-]*$/),
  force: z.boolean().default(false),
});

/** "Nieuwe patiënt" inside Afspraak maken: duplicate check on name + date of birth and on e-mail, then create. */
export const createStaffPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => newPatientSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tenant = await staffTenant(context);
    if (!tenant) throw new Error("Forbidden");
    const db = await admin();
    const cols = "id, patient_number, first_name, last_name, date_of_birth, email";
    const [byName, byEmail] = await Promise.all([
      db.from("patients").select(cols).eq("tenant_id", tenant.id).is("deleted_at", null).ilike("first_name", data.firstName).ilike("last_name", data.lastName).eq("date_of_birth", data.dateOfBirth).limit(5),
      db.from("patients").select(cols).eq("tenant_id", tenant.id).is("deleted_at", null).ilike("email", data.email).limit(5),
    ]);
    const seen = new Map<string, NonNullable<typeof byName.data>[number]>();
    for (const p of [...(byName.data ?? []), ...(byEmail.data ?? [])]) seen.set(p.id, p);
    // An existing e-mail is never duplicated; a name + date-of-birth match may be overridden on purpose.
    const emailTaken = (byEmail.data ?? []).length > 0;
    if (seen.size && (!data.force || emailTaken)) return { ok: false as const, duplicates: [...seen.values()], emailTaken };
    const ins = await context.supabase.from("patients")
      .insert({ tenant_id: tenant.id, first_name: data.firstName, last_name: data.lastName, date_of_birth: data.dateOfBirth, email: data.email, phone: data.phone || null })
      .select(cols).single();
    if (ins.error || !ins.data) return { ok: false as const, duplicates: [], emailTaken: false, failed: true };
    return { ok: true as const, patient: ins.data };
  });
