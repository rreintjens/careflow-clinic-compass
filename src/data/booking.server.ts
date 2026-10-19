/** Server-only helpers for the public booking functions. */
import { getRequestHeader } from "@tanstack/react-start/server";

import { normalizeHost } from "@/domain/tenancy";
import { freeSlots, mergeByTime, type Busy, type Slot, type SlotBlock, type SlotException } from "@/domain/slots";
import { mockExternalBusyProvider } from "./external-busy.server";

export async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}
/** Brand from the booking host; a slug in the URL is honoured only for brands in test mode. */
export async function resolveTenant(slug: string | undefined) {
  const db = await admin();
  const host = normalizeHost(getRequestHeader("x-forwarded-host") ?? getRequestHeader("host"));
  const { data } = await db.from("tenants").select("id, slug, display_name, time_zone, default_language, extra_languages, test_mode, booking_domains, google_meet_account, mail_sender, mail_sender_verified, ekis_export_enabled, stats_key_hash");
  const rows = data ?? [];
  const byHost = rows.find((t) => host && t.booking_domains.includes(host));
  if (byHost) return byHost;
  if (slug) return rows.find((t) => t.slug === slug && t.test_mode) ?? null;
  // No ?merk= and an unknown host: in demo the preview falls back to the test brand.
  return rows.find((t) => t.slug === "tbc-nl" && t.test_mode) ?? null;
}
export const settingNum = (rows: Array<{ key: string; value: unknown }>, key: string, fallback: number) => {
  const v = rows.find((r) => r.key === key)?.value;
  return typeof v === "number" ? v : fallback;
};
/** Local date and minute in the brand's time zone. */
export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
}
export const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
export type Tenant = NonNullable<Awaited<ReturnType<typeof resolveTenant>>>;
export type SlotQuery = { treatmentId: string; locationId: string; practitionerIds: string[]; from: string; days: number };

export async function computeSlots(tenant: Tenant, data: SlotQuery) {
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

    const [pt, pl, locs, mixed] = await Promise.all([
      db.from("practitioner_treatments").select("practitioner_id, excluded_location_ids").eq("tenant_id", tid).eq("treatment_id", data.treatmentId),
      db.from("practitioner_locations").select("practitioner_id").eq("tenant_id", tid).eq("location_id", data.locationId),
      db.from("locations").select("id, kind").eq("tenant_id", tid),
      db.from("schedule_blocks").select("practitioner_id, location_id, treatment_ids").eq("tenant_id", tid).eq("allows_online", true),
    ]);
    const onlineLocationIds = (locs.data ?? []).filter((l) => l.kind === "online").map((l) => l.id);
    const atLoc = new Set((pl.data ?? []).map((r) => r.practitioner_id));
    if (onlineLocationIds.includes(data.locationId)) for (const b of mixed.data ?? []) {
      if (!onlineLocationIds.includes(b.location_id) && (!b.treatment_ids?.length || b.treatment_ids.includes(data.treatmentId))) atLoc.add(b.practitioner_id);
    }
    let eligible = (pt.data ?? []).filter((r) => atLoc.has(r.practitioner_id) && !(r.excluded_location_ids ?? []).includes(data.locationId)).map((r) => r.practitioner_id);
    if (data.practitionerIds.length) eligible = eligible.filter((p) => data.practitionerIds.includes(p));
    if (!eligible.length) return { perPractitioner: {}, merged: [], today: localParts(new Date(), tenant.time_zone).date };

    const now = localParts(new Date(), tenant.time_zone);
    const to = addDays(data.from, data.days);
    const [blocks, exc, appts, external] = await Promise.all([
      db.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids, allows_online").eq("tenant_id", tid).in("practitioner_id", eligible),
      db.from("schedule_exceptions").select("practitioner_id, kind, date_from, date_to, starts, ends, location_id").eq("tenant_id", tid).in("practitioner_id", eligible).lte("date_from", to),
      db.from("appointments").select("practitioner_id, starts_at, ends_at, status, hold_expires_at").eq("tenant_id", tid).in("practitioner_id", eligible).in("status", ["held", "booked"])
        .gte("starts_at", new Date(`${data.from}T00:00:00Z`).toISOString()).lte("starts_at", new Date(`${to}T23:59:59Z`).toISOString()),
      mockExternalBusyProvider.read(db, tid, `${data.from}T00:00:00Z`, `${to}T23:59:59Z`),
    ]);
    const nowMs = Date.now();
    const busy: Busy[] = (appts.data ?? []).filter((a) => a.status === "booked" || (a.hold_expires_at && Date.parse(a.hold_expires_at) > nowMs)).map((a) => {
      const s = localParts(new Date(a.starts_at), tenant.time_zone);
      const e = localParts(new Date(a.ends_at), tenant.time_zone);
      return { practitioner_id: a.practitioner_id, date: s.date, start: s.minute, end: e.date === s.date ? e.minute : 24 * 60 };
    });
    const counts = new Map<string, number>();
    for (const b of busy) counts.set(`${b.practitioner_id}|${b.date}`, (counts.get(`${b.practitioner_id}|${b.date}`) ?? 0) + 1);
    for (const b of external) {
      const start = localParts(new Date(b.starts_at), tenant.time_zone), end = localParts(new Date(b.ends_at), tenant.time_zone);
      busy.push({ practitioner_id: b.practitioner_id, date: start.date, start: start.minute, end: end.minute });
    }

    const perPractitioner: Record<string, Slot[]> = {};
    const merged: Slot[] = [];
    for (let i = 0; i < data.days; i++) {
      const date = addDays(data.from, i);
      const slots = freeSlots({
        date, locationId: data.locationId, treatmentId: data.treatmentId, durationMin: t.data.duration_min, practitionerIds: eligible, onlineLocationIds,
        blocks: (blocks.data ?? []) as SlotBlock[], exceptions: (exc.data ?? []) as SlotException[], busy, now, leadMinutes: lead, maxAheadWeeks: maxWeeks,
      });
      for (const s of slots) (perPractitioner[s.practitioner_id] ??= []).push(s);
      merged.push(...mergeByTime(slots, (p) => counts.get(`${p}|${date}`) ?? 0));
    }
    return { perPractitioner, merged, today: now.date };
  }

/** UTC instant for a local date + minute in the brand's time zone. */
export function localToUtc(date: string, minute: number, tz: string) {
  const target = Date.parse(`${date}T00:00:00Z`) + minute * 60_000;
  let guess = target;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(guess), tz);
    const seen = Date.parse(`${p.date}T00:00:00Z`) + p.minute * 60_000;
    guess += target - seen;
  }
  return new Date(guess);
}
