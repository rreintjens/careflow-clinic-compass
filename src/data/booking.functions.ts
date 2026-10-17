/**
 * Public booking reads. Patients are anonymous, so these run with the admin client after
 * resolving the brand from the host; they return only what the booking screens show
 * (no patient data, no staff e-mail, no internal notes).
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { normalizeHost } from "@/domain/tenancy";
import { freeSlots, mergeByTime, type Busy, type Slot, type SlotBlock, type SlotException } from "@/domain/slots";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Brand from the booking host; a slug in the URL is honoured only for brands in test mode. */
async function resolveTenant(slug: string | undefined) {
  const db = await admin();
  const host = normalizeHost(getRequestHeader("x-forwarded-host") ?? getRequestHeader("host"));
  const { data } = await db.from("tenants").select("id, slug, display_name, time_zone, default_language, extra_languages, test_mode, booking_domains");
  const rows = data ?? [];
  const byHost = rows.find((t) => host && t.booking_domains.includes(host));
  if (byHost) return byHost;
  const bySlug = slug ? rows.find((t) => t.slug === slug && t.test_mode) : undefined;
  return bySlug ?? null;
}

const settingNum = (rows: Array<{ key: string; value: unknown }>, key: string, fallback: number) => {
  const v = rows.find((r) => r.key === key)?.value;
  return typeof v === "number" ? v : fallback;
};

export const getBookingCatalog = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merk: z.string().max(60).optional() }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    const db = await admin();
    const { data: ui } = await db.from("option_lists").select("list_key, value, label_nl, label_en").in("list_key", ["booking_ui", "questionnaire_ui"]);
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

/** Local date and minute in the brand's time zone. */
function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
}
const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

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

type Tenant = NonNullable<Awaited<ReturnType<typeof resolveTenant>>>;
type SlotQuery = { treatmentId: string; locationId: string; practitionerIds: string[]; from: string; days: number };

async function computeSlots(tenant: Tenant, data: SlotQuery) {
    const db = await admin();
    const tid = tenant.id;
    const [t, settings] = await Promise.all([
      db.from("treatments").select("id, duration_min, status").eq("tenant_id", tid).eq("id", data.treatmentId).maybeSingle(),
      db.from("settings").select("key, value").eq("tenant_id", tid),
    ]);
    if (!t.data || t.data.status !== "active") return { perPractitioner: {}, merged: [], today: "" };
    const st = (settings.data ?? []) as Array<{ key: string; value: unknown }>;
    const lead = settingNum(st, "min_lead_minutes", 120);
    const maxWeeks = settingNum(st, "max_ahead_weeks", 8);

    const [pt, pl] = await Promise.all([
      db.from("practitioner_treatments").select("practitioner_id, excluded_location_ids").eq("tenant_id", tid).eq("treatment_id", data.treatmentId),
      db.from("practitioner_locations").select("practitioner_id").eq("tenant_id", tid).eq("location_id", data.locationId),
    ]);
    const atLoc = new Set((pl.data ?? []).map((r) => r.practitioner_id));
    let eligible = (pt.data ?? []).filter((r) => atLoc.has(r.practitioner_id) && !(r.excluded_location_ids ?? []).includes(data.locationId)).map((r) => r.practitioner_id);
    if (data.practitionerIds.length) eligible = eligible.filter((p) => data.practitionerIds.includes(p));
    if (!eligible.length) return { perPractitioner: {}, merged: [], today: localParts(new Date(), tenant.time_zone).date };

    const now = localParts(new Date(), tenant.time_zone);
    const to = addDays(data.from, data.days);
    const [blocks, exc, appts] = await Promise.all([
      db.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids").eq("tenant_id", tid).in("practitioner_id", eligible),
      db.from("schedule_exceptions").select("practitioner_id, kind, date_from, date_to, starts, ends, location_id").eq("tenant_id", tid).in("practitioner_id", eligible).lte("date_from", to),
      db.from("appointments").select("practitioner_id, starts_at, ends_at, status, hold_expires_at").eq("tenant_id", tid).in("practitioner_id", eligible).in("status", ["held", "booked"])
        .gte("starts_at", new Date(`${data.from}T00:00:00Z`).toISOString()).lte("starts_at", new Date(`${to}T23:59:59Z`).toISOString()),
    ]);
    const nowMs = Date.now();
    const busy: Busy[] = (appts.data ?? []).filter((a) => a.status === "booked" || (a.hold_expires_at && Date.parse(a.hold_expires_at) > nowMs)).map((a) => {
      const s = localParts(new Date(a.starts_at), tenant.time_zone);
      const e = localParts(new Date(a.ends_at), tenant.time_zone);
      return { practitioner_id: a.practitioner_id, date: s.date, start: s.minute, end: e.date === s.date ? e.minute : 24 * 60 };
    });
    const counts = new Map<string, number>();
    for (const b of busy) counts.set(`${b.practitioner_id}|${b.date}`, (counts.get(`${b.practitioner_id}|${b.date}`) ?? 0) + 1);

    const perPractitioner: Record<string, Slot[]> = {};
    const merged: Slot[] = [];
    for (let i = 0; i < data.days; i++) {
      const date = addDays(data.from, i);
      const slots = freeSlots({
        date, locationId: data.locationId, treatmentId: data.treatmentId, durationMin: t.data.duration_min, practitionerIds: eligible,
        blocks: (blocks.data ?? []) as SlotBlock[], exceptions: (exc.data ?? []) as SlotException[], busy, now, leadMinutes: lead, maxAheadWeeks: maxWeeks,
      });
      for (const s of slots) (perPractitioner[s.practitioner_id] ??= []).push(s);
      merged.push(...mergeByTime(slots, (p) => counts.get(`${p}|${date}`) ?? 0));
    }
    return { perPractitioner, merged, today: now.date };
  }

/** UTC instant for a local date + minute in the brand's time zone. */
function localToUtc(date: string, minute: number, tz: string) {
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), tz);
    const seen = Date.parse(`${p.date}T00:00:00Z`) + p.minute * 60_000;
    guess += target - seen;
  }
  return new Date(guess);
}

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
    replaceToken: z.string().uuid().optional(),
  }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { ok: false as const };
    const db = await admin();
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
      language: data.language, source: data.source ?? null,
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
