/**
 * Public booking reads. Patients are anonymous, so these run with the admin client after
 * resolving the brand from the host; they return only what the booking screens show
 * (no patient data, no staff e-mail, no internal notes).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Slot } from "@/domain/slots";
import { admin, attachMeeting, computeSlots, localParts, localToUtc, resolveTenant, settingNum } from "./booking.server";




export const getBookingCatalog = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merk: z.string().max(60).optional() }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    const db = await admin();
    const { data: ui } = await db.from("option_lists").select("list_key, value, label_nl, label_en").in("list_key", ["booking_ui", "questionnaire_ui", "salutation", "referral_source", "country", "phone_country"]).order("sort");
    if (!tenant) return { tenant: null, ui: ui ?? [] } as const;
    const tid = tenant.id;
    const [cats, links, treatments, tLocs, locs, prs, pLocs, pTreat, roles, tRoles, settings] = await Promise.all([
      db.from("treatment_categories").select("id, parent_id, name_nl, name_en, icon, sort").eq("tenant_id", tid).order("sort"),
      db.from("treatment_category_links").select("treatment_id, category_id, sort").eq("tenant_id", tid),
      db.from("treatments").select("id, slug, name_nl, name_en, icon, duration_min, practitioner_choice, status, pre_questionnaire_key, post_questionnaire_key").eq("tenant_id", tid).eq("status", "active"),
      db.from("treatment_locations").select("treatment_id, location_id").eq("tenant_id", tid),
      db.from("locations").select("id, slug, name, kind, address, status, show_new_label, sort").eq("tenant_id", tid).order("sort"),
      db.from("practitioners").select("id, first_name, last_name, role_id, photo_path, status, sort").eq("tenant_id", tid).eq("status", "active"),
      db.from("practitioner_locations").select("practitioner_id, location_id").eq("tenant_id", tid),
      db.from("practitioner_treatments").select("practitioner_id, treatment_id, excluded_location_ids").eq("tenant_id", tid),
      db.from("practitioner_roles").select("id, name_nl, name_en").eq("tenant_id", tid),
      db.from("treatment_practitioner_roles").select("treatment_id, role_id").eq("tenant_id", tid),
      db.from("settings").select("key, value").eq("tenant_id", tid),
    ]);
    const bucket = `practitioner-photos-${tenant.slug}`;
    const photos = await Promise.all((prs.data ?? []).map(async (p) => {
      if (!p.photo_path) return null;
      const { data: s } = await db.storage.from(bucket).createSignedUrl(p.photo_path, 3600);
      return s?.signedUrl ?? null;
    }));
    const st = (settings.data ?? []) as Array<{ key: string; value: unknown }>;
    const phone = st.find((r) => r.key === "mail_phone")?.value;
    return {
      tenant: { slug: tenant.slug, name: tenant.display_name, languages: [tenant.default_language, ...tenant.extra_languages], phone: typeof phone === "string" ? phone : null },
      ui: ui ?? [],
      categories: cats.data ?? [],
      links: links.data ?? [],
      treatments: treatments.data ?? [],
      treatmentLocations: tLocs.data ?? [],
      locations: (locs.data ?? []).filter((l) => l.status === "open"),
      practitioners: (prs.data ?? []).map((p, i) => ({ id: p.id, first_name: p.first_name, last_name: p.last_name, role_id: p.role_id, photo: photos[i] ?? null, sort: p.sort })),
      practitionerLocations: pLocs.data ?? [],
      practitionerTreatments: pTreat.data ?? [],
      roles: roles.data ?? [],
      treatmentRoles: tRoles.data ?? [],
      maxAheadWeeks: settingNum(st, "max_ahead_weeks", 8),
    };
  });


/**
 * Free times for a treatment at a location from `from` for `days` days.
 * `practitionerIds` limits to chosen practitioners; empty = all eligible ("no preference").
 */
export const getBookingSlots = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    merk: z.string().max(60).optional(),
    treatmentId: z.string().uuid(),
    locationId: z.string().uuid(),
    practitionerIds: z.array(z.string().uuid()).max(100),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    days: z.number().int().min(1).max(70),
  }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { perPractitioner: {} as Record<string, Slot[]>, merged: [] as Slot[], today: "" };
    return computeSlots(tenant, data);
  });


/** Holds a free slot for the configured minutes. Re-checks availability so two patients cannot hold the same time. */
export const holdSlot = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    merk: z.string().max(60).optional(),
    treatmentId: z.string().uuid(),
    locationId: z.string().uuid(),
    practitionerId: z.union([z.string().uuid(), z.literal("any")]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    language: z.enum(["nl", "en"]),
    source: z.string().max(80).optional(),
    link: z.string().max(60).optional(),
    replaceToken: z.string().uuid().optional(),
  }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { ok: false as const };
    const db = await admin();
    const linkRow = data.link
      ? (await db.from("booking_links").select("id, source").eq("tenant_id", tenant.id).eq("slug", data.link).eq("status", "active").maybeSingle()).data
      : null;
    if (data.link && !linkRow) return { ok: false as const };
    if (data.replaceToken) await db.from("appointments").update({ status: "released" }).eq("tenant_id", tenant.id).eq("hold_token", data.replaceToken).eq("status", "held");
    const minute = Number(data.time.slice(0, 2)) * 60 + Number(data.time.slice(3));
    const slots = await computeSlots(tenant, { treatmentId: data.treatmentId, locationId: data.locationId, practitionerIds: data.practitionerId === "any" ? [] : [data.practitionerId], from: data.date, days: 1 });
    const pick = data.practitionerId === "any"
      ? slots.merged.find((x) => x.date === data.date && x.start === minute)
      : slots.perPractitioner[data.practitionerId]?.find((x) => x.date === data.date && x.start === minute);
    if (!pick) return { ok: false as const };
    const st = ((await db.from("settings").select("key, value").eq("tenant_id", tenant.id)).data ?? []) as Array<{ key: string; value: unknown }>;
    const raw = st.find((r) => r.key === "slot_hold_minutes")?.value;
    const holdMin = Number(raw) > 0 ? Number(raw) : 15;
    const t = await db.from("treatments").select("duration_min").eq("id", data.treatmentId).single();
    const startsAt = localToUtc(data.date, minute, tenant.time_zone);
    const endsAt = new Date(startsAt.getTime() + (t.data?.duration_min ?? 30) * 60_000);
    const expires = new Date(Date.now() + holdMin * 60_000);
    const ins = await db.from("appointments").insert({
      tenant_id: tenant.id, treatment_id: data.treatmentId, location_id: data.locationId, practitioner_id: pick.practitioner_id,
      starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), status: "held", hold_expires_at: expires.toISOString(),
      language: data.language, source: data.source ?? linkRow?.source ?? null, booking_link_id: linkRow?.id ?? null,
    }).select("hold_token").single();
    if (ins.error || !ins.data?.hold_token) return { ok: false as const };
    // Lost a race: another hold for the same practitioner overlaps and was created first.
    const clash = await db.from("appointments").select("id, hold_token, created_at").eq("tenant_id", tenant.id).eq("practitioner_id", pick.practitioner_id)
      .in("status", ["held", "booked"]).lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString()).order("created_at").limit(1);
    if (clash.data?.[0] && clash.data[0].hold_token !== ins.data.hold_token) {
      await db.from("appointments").update({ status: "released" }).eq("hold_token", ins.data.hold_token);
      return { ok: false as const };
    }
    return { ok: true as const, token: ins.data.hold_token, expiresAt: expires.toISOString(), holdMinutes: holdMin, practitionerId: pick.practitioner_id };
  });

/** Releases a hold. With a triage reason the rejection is counted anonymously; no answers are stored. */
export const releaseHold = createServerFn({ method: "POST" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), token: z.string().uuid(), questionnaire: z.string().max(80).optional(), reason: z.string().max(80).optional() }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { ok: false };
    const db = await admin();
    const r = await db.from("appointments").update({ status: "released" }).eq("tenant_id", tenant.id).eq("hold_token", data.token).eq("status", "held").select("id");
    if (data.reason && data.questionnaire && r.data?.length) await db.rpc("count_triage_rejection", { _tenant: tenant.id, _questionnaire: data.questionnaire, _reason: data.reason });
    return { ok: true };
  });

/** Published triage (before booking) for a treatment, with its flow settings. */
export const getTriage = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), key: z.string().max(80) }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return null;
    const db = await admin();
    const q = (await db.from("questionnaires").select("id, key, flow_id").eq("tenant_id", tenant.id).eq("key", data.key).maybeSingle()).data;
    if (!q) return null;
    const [v, f] = await Promise.all([
      db.from("questionnaire_versions").select("definition").eq("questionnaire_id", q.id).eq("status", "published").maybeSingle(),
      db.from("questionnaire_flows").select("document").eq("id", q.flow_id).maybeSingle(),
    ]);
    if (!v.data) return null;
    return { key: q.key, definition: v.data.definition, flow: f.data?.document ?? {} };
  });

/** Dutch address from postcode + house number (public PDOK locatieserver). */
export const lookupAddress = createServerFn({ method: "POST" })
  .inputValidator(z.object({ postcode: z.string().regex(/^\d{4}\s?[A-Za-z]{2}$/), houseNumber: z.string().regex(/^\d{1,5}$/), suffix: z.string().max(10).optional() }))
  .handler(async ({ data }) => {
    const pc = data.postcode.replace(/\s/g, "").toUpperCase();
    const q = `postcode:${pc} AND huisnummer:${data.houseNumber}`;
    try {
      const r = await fetch(`https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?fq=type:adres&rows=5&q=${encodeURIComponent(q)}`);
      if (!r.ok) return null;
      const j = (await r.json()) as { response?: { docs?: Array<{ straatnaam?: string; woonplaatsnaam?: string; huisletter?: string; huisnummertoevoeging?: string }> } };
      const docs = j.response?.docs ?? [];
      const sfx = (data.suffix ?? "").trim().toLowerCase();
      const d = docs.find((x) => `${x.huisletter ?? ""}${x.huisnummertoevoeging ?? ""}`.toLowerCase() === sfx) ?? docs[0];
      return d?.straatnaam ? { street: d.straatnaam, city: d.woonplaatsnaam ?? "" } : null;
    } catch { return null; }
  });

const detailsSchema = z.object({
  merk: z.string().max(60).optional(),
  token: z.string().uuid(),
  existing: z.boolean(),
  salutation: z.string().max(40),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  email: z.string().trim().email().max(200),
  phoneCountry: z.string().max(6),
  phone: z.string().trim().min(6).max(20),
  country: z.string().max(4),
  postcode: z.string().trim().min(3).max(10),
  houseNumber: z.string().trim().min(1).max(10),
  suffix: z.string().trim().max(10).optional(),
  street: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  referral: z.string().max(40).optional(),
  note: z.string().max(1000).optional(),
  consentPrivacy: z.literal(true),
  consentGp: z.boolean(),
  gpName: z.string().max(160).optional(),
  consentLsp: z.boolean(),
  consentMarketing: z.boolean(),
  triageKey: z.string().max(80).optional(),
  triageAnswers: z.record(z.string(), z.unknown()).optional(),
});

/** Turns a held slot into a booked appointment: finds or creates the patient, stores consents and the triage answers. */
export const confirmBooking = createServerFn({ method: "POST" })
  .inputValidator(detailsSchema)
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { ok: false as const, reason: "failed" };
    const db = await admin();
    const appt = (await db.from("appointments").select("id, status, hold_expires_at, manage_token").eq("tenant_id", tenant.id).eq("hold_token", data.token).maybeSingle()).data;
    if (!appt || appt.status !== "held" || !appt.hold_expires_at || Date.parse(appt.hold_expires_at) <= Date.now()) return { ok: false as const, reason: "expired" };
    const today = localParts(new Date(), tenant.time_zone).date;
    const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
    const [by, bm, bd] = data.dateOfBirth.split("-").map(Number) as [number, number, number];
    const age = ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
    if (age < 18) return { ok: false as const, reason: "young" };

    const email = data.email.toLowerCase();
    const fields = {
      salutation: data.salutation, first_name: data.firstName, last_name: data.lastName, date_of_birth: data.dateOfBirth, email,
      phone_country: data.phoneCountry, phone: data.phone, country: data.country, postcode: data.postcode.toUpperCase(), house_number: data.houseNumber,
      house_suffix: data.suffix || null, street: data.street, city: data.city, gp_name: data.consentGp ? data.gpName || null : null,
    };
    const match = (await db.from("patients").select("id").eq("tenant_id", tenant.id).ilike("email", email).eq("date_of_birth", data.dateOfBirth).is("deleted_at", null).limit(1)).data?.[0];
    let patientId = match?.id;
    if (!patientId) {
      const ins = await db.from("patients").insert({ tenant_id: tenant.id, ...fields }).select("id").single();
      if (ins.error || !ins.data) return { ok: false as const, reason: "failed" };
      patientId = ins.data.id;
    }
    const upd = await db.from("appointments").update({
      status: "booked", patient_id: patientId, hold_expires_at: null, referral_source: data.referral || null, patient_note: data.note || null, new_patient: !match,
    }).eq("id", appt.id).eq("status", "held").select("id");
    if (!upd.data?.length) return { ok: false as const, reason: "expired" };
    await db.from("patient_consents").insert([
      { kind: "privacy", granted: true }, { kind: "gp", granted: data.consentGp }, { kind: "lsp", granted: data.consentLsp }, { kind: "marketing", granted: data.consentMarketing },
    ].map((c) => ({ ...c, tenant_id: tenant.id, patient_id: patientId, appointment_id: appt.id })));
    await attachMeeting(db, tenant, appt.id);
    if (data.triageKey && data.triageAnswers) {
      await db.from("answer_sets").insert({ tenant_id: tenant.id, patient_id: patientId, appointment_id: appt.id, questionnaire_key: data.triageKey, answers: data.triageAnswers as never, status: "completed", completed_at: new Date().toISOString() });
    }
    return { ok: true as const, manageToken: appt.manage_token };
  });
