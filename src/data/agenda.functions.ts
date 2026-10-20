/** Staff scheduling from the agenda. Caller must be aal2 with agenda.appointments in the active tenant. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin, computeSlots, localParts, localToUtc } from "./booking.server";
import { attachMeeting } from "./meeting.server";
import { safeQueue } from "./mailer.server";
import { appointmentResources } from "@/domain/appointment-resources";
import { authorizedDoubleBooking, blockingStatuses } from "@/domain/appointment-status";
import type { DeviceLite, Placement } from "@/domain/equipment";
import { workIntervals } from "@/domain/slots";
import type { SlotBlock, SlotException } from "@/domain/slots";
import {notificationPlanSchema} from "@/domain/appointment-notifications";
import {appointmentPreparation} from "./appointment-preparation.server";

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
  .inputValidator(z.object({ treatmentId: z.string().uuid(), locationId: z.string().uuid(), practitionerId: z.string().uuid(), appointmentId:z.string().uuid().optional() }))
  .handler(async ({ data, context }) => {
    const tenant = await staffTenant(context as unknown as Ctx);
    if (!tenant) return [];
    const from = localParts(new Date(), tenant.time_zone).date;
    if(data.appointmentId && !(await context.supabase.from("appointments").select("id").eq("id",data.appointmentId).maybeSingle()).data) return [];
    const r = await computeSlots(tenant, { treatmentId: data.treatmentId, locationId: data.locationId, practitionerIds: [data.practitionerId], from, days: 28, excludeAppointmentId:data.appointmentId });
    return (r.perPractitioner[data.practitionerId] ?? []).slice(0, 3).map((s) => ({ date: s.date, start: s.start }));
  });

export const getStaffPreparation=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
 .inputValidator(z.object({patientId:z.string().uuid(),treatmentId:z.string().uuid(),at:z.string().datetime(),appointmentId:z.string().uuid().optional()}))
 .handler(async({data,context})=>{
  const tenant=await staffTenant(context);if(!tenant)throw new Error("Geen toegang.");
  if(!(await context.supabase.from("patients").select("id").eq("id",data.patientId).maybeSingle()).data)throw new Error("Geen toegang.");
  return appointmentPreparation(tenant.id,data.patientId,data.treatmentId,data.at,data.appointmentId);
 });

export const createStaffAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    patientId: z.string().uuid(), treatmentId: z.string().uuid(), locationId: z.string().uuid(), practitionerId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), start: z.number().int().min(0).max(1439), notify: z.string().max(40), reason: z.string().max(40).nullable(),
    kind: z.string().max(40).optional(), tentative: z.boolean().default(false), roomId: z.string().uuid().optional(),
    doubleBookReason: z.string().trim().min(3).max(500).optional(),
    appointmentId:z.string().uuid().optional(), expectedStartsAt:z.string().optional(), waitlistId:z.string().uuid().optional(),
    notificationPlan:notificationPlanSchema.optional(),
  }))
  .handler(async ({ data, context }) => {
    const tenant = await staffTenant(context as unknown as Ctx);
    if (!tenant) return { ok: false as const, reason: "forbidden" };
    const existing=data.appointmentId?(await context.supabase.from("appointments").select("id,status,patient_id,starts_at").eq("id",data.appointmentId).maybeSingle()).data:null;
    if(data.appointmentId && (!existing || existing.patient_id!==data.patientId || existing.starts_at!==data.expectedStartsAt || !["booked","tentatief"].includes(existing.status))) return {ok:false as const,reason:"changed"};
    if(data.waitlistId && !(await context.supabase.from("waitlist_entries").select("id").eq("id",data.waitlistId).eq("patient_id",data.patientId).eq("status","open").maybeSingle()).data) return {ok:false as const,reason:"changed"};
    const r = await computeSlots(tenant, { treatmentId: data.treatmentId, locationId: data.locationId, practitionerIds: [data.practitionerId], from: data.date, days: 1,excludeAppointmentId:data.appointmentId });
    const free = (r.perPractitioner[data.practitionerId] ?? []).some((s) => s.date === data.date && s.start === data.start);
    if (!free && !data.doubleBookReason) return { ok: false as const, reason: "taken" };
    const db = await admin();
    const t = (await db.from("treatments").select("duration_min").eq("id", data.treatmentId).single()).data;
    const startsAt = localToUtc(data.date, data.start, tenant.time_zone);
    const endsAt = new Date(startsAt.getTime() + (t?.duration_min ?? 30) * 60_000);
    if (data.doubleBookReason) {
      if (!authorizedDoubleBooking(!!(await context.supabase.rpc("has_permission",{_perm:"agenda.double_book"})).data,data.doubleBookReason)) return {ok:false as const,reason:"forbidden"};
      const [blocks,exceptions,eligible,locations] = await Promise.all([context.supabase.from("schedule_blocks").select("*").eq("practitioner_id",data.practitionerId),context.supabase.from("schedule_exceptions").select("*").eq("practitioner_id",data.practitionerId),context.supabase.from("practitioner_treatments").select("excluded_location_ids").eq("practitioner_id",data.practitionerId).eq("treatment_id",data.treatmentId).maybeSingle(),context.supabase.from("locations").select("id,kind")]);
      if(!eligible.data || eligible.data.excluded_location_ids.includes(data.locationId) || !workIntervals({practitionerId:data.practitionerId,locationId:data.locationId,treatmentId:data.treatmentId,date:data.date,blocks:(blocks.data??[]) as SlotBlock[],exceptions:(exceptions.data??[]) as SlotException[],onlineLocationIds:(locations.data??[]).filter(l=>l.kind==="online").map(l=>l.id)}).some(([s,e])=>s<=data.start && data.start+(t?.duration_min??30)<=e)) return {ok:false as const,reason:"taken"};
    }
    const userDb = context.supabase;
    const [patient, location, options, requirements, rooms, equipment, types, kinds, schedule, occupied] = await Promise.all([
      userDb.from("patients").select("id,online_booking_blocked,labels").eq("id",data.patientId).single(),
      userDb.from("locations").select("kind").eq("id",data.locationId).single(),
      userDb.from("option_lists").select("list_key,value").in("list_key",["agenda_notify","agenda_reason","appointment_kind"]),
      userDb.from("treatment_requirements").select("kind,equipment_kind").eq("treatment_id",data.treatmentId),
      userDb.from("rooms").select("id,location_id"), userDb.from("equipment").select("*"), userDb.from("equipment_types").select("id,kind_id"), userDb.from("equipment_kinds").select("id,key"), userDb.from("equipment_schedule").select("equipment_id,weekday,location_id"),
      userDb.from("appointments").select("id,room_id,equipment_ids").in("status",blockingStatuses).lt("starts_at",endsAt.toISOString()).gt("ends_at",startsAt.toISOString()),
    ]);
    if ([patient,location,options,requirements,rooms,equipment,types,kinds,schedule,occupied].some(x=>x.error) || patient.data?.labels.includes("niet_welkom")) return {ok:false as const,reason:"forbidden"};
    if (!options.data?.some(o=>o.list_key==="agenda_notify" && o.value===data.notify) || (data.kind && !options.data?.some(o=>o.list_key==="appointment_kind" && o.value===data.kind)) || (data.reason && !options.data?.some(o=>o.list_key==="agenda_reason" && o.value===data.reason))) return {ok:false as const,reason:"invalid"};
    let assigned:{roomId:string|null;equipmentIds:string[]} = {roomId:null,equipmentIds:[]};
    if (location.data?.kind === "clinic") {
      const devices:DeviceLite[]=(equipment.data??[]).map(d=>({id:d.id,kind:kinds.data?.find(k=>k.id===types.data?.find(t=>t.id===d.type_id)?.kind_id)?.key??d.kind,placement:d.placement as Placement,location_id:d.location_id,room_id:d.room_id,status:d.status,next_maintenance_on:d.next_maintenance_on,schedule:(schedule.data??[]).filter(s=>s.equipment_id===d.id)}));
      assigned=appointmentResources({locationId:data.locationId,date:data.date,roomId:data.roomId,kinds:(requirements.data??[]).filter(r=>r.kind==="equipment" && r.equipment_kind).map(r=>r.equipment_kind??""),rooms:rooms.data??[],devices,busy:(occupied.data??[]).filter(a=>a.id!==data.appointmentId)});
      if(!assigned.roomId) return {ok:false as const,reason:"resources"};
    }
    // Insert as the signed-in user, so RLS (tenant + permission) and the audit trigger apply.
    const row = {
      patient_id: data.patientId, treatment_id: data.treatmentId, location_id: data.locationId, practitioner_id: data.practitionerId,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), room_id:assigned.roomId,equipment_ids:assigned.equipmentIds,kind:data.kind??null,
      status: data.tentative ? "tentatief" : "booked", notify: data.notify, booking_reason: data.reason,
      double_book_reason:data.doubleBookReason??null,
      ...(data.notificationPlan ? {notification_plan:data.notificationPlan}:{}),
    };
    const ins=existing?await userDb.from("appointments").update(row).eq("id",existing.id).eq("starts_at",existing.starts_at).eq("status",existing.status).select("id").single():await userDb.from("appointments").insert({...row,source:"agenda",new_patient:false}).select("id").single();
    if (ins.error) return { ok: false as const, reason: ins.error.message.includes("eKis") ? "external_busy" : "failed" };
    await attachMeeting(db, tenant, (ins.data as { id: string }).id);
    if(data.waitlistId) await userDb.from("waitlist_entries").update({status:"resolved"}).eq("id",data.waitlistId).eq("patient_id",data.patientId);
    await safeQueue(db, ins.data.id, existing?"rescheduled":"confirmation", { dedupe: `${existing?"rescheduled":"confirmation"}-${ins.data.id}-${startsAt.toISOString()}` });
    try {
      const preparation=await appointmentPreparation(tenant.id,data.patientId,data.treatmentId,startsAt.toISOString(),ins.data.id);
      if(preparation.questionnaireMissing)await safeQueue(db,ins.data.id,"questionnaire_reminder",{dedupe:`questionnaire_reminder-${ins.data.id}`});
      if(preparation.detailsMissing)await safeQueue(db,ins.data.id,"details_reminder",{dedupe:`details_reminder-${ins.data.id}`});
    }catch(e){console.error("[appointment] preparation mail check failed",e);}
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
