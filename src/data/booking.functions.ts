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
  });
