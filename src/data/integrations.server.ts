/** Server-only data for the integrations: the daily eKis export and the statistics API. */
import { createHash } from "node:crypto";

import { buildEkisDocument, exportLabel, nextExportAt, type EkisAnswerSet } from "@/domain/ekis";
import { blockOn, toMin, type SlotBlock } from "@/domain/slots";
import { bySource, noShowRate, occupancy, perDay, type CountRow, type DayCounts, type SourceCount } from "@/domain/stats";
import { addLocalDays, zonedParts } from "@/domain/time";
import type { Json } from "@/integrations/supabase/types";
import { admin, type Tenant } from "./booking.server";

/** A statistics key is only ever stored as a hash, so a leaked table cannot be replayed. */
export const hashStatsKey = (key: string) => createHash("sha256").update(key, "utf8").digest("hex");

/** The brand a statistics key belongs to, or null when the key is unknown. */
export async function tenantByStatsKey(key: string) {
  const db = await admin();
  const { data } = await db.from("tenants").select("id, slug, display_name, time_zone, stats_key_hash").eq("stats_key_hash", hashStatsKey(key)).maybeSingle();
  return data ?? null;
}

/** Brand row for a staff session: the same columns the booking resolver uses, so the types agree. */
export async function tenantById(id: string) {
  const db = await admin();
  const { data } = await db
    .from("tenants")
    .select("id, slug, display_name, time_zone, default_language, extra_languages, test_mode, booking_domains, google_meet_account, mail_sender, mail_sender_verified, ekis_export_enabled, stats_key_hash")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as Tenant | null;
}

export interface EkisRun {
  id: string;
  ranAt: string;
  patients: number;
  answerSets: number;
  document: unknown;
}

/** One export file: everyone who arrived since the previous run, with the answers they filled in. */
export async function runEkisExport(tenantId: string, kind: "schedule" | "manual", userId: string | null = null): Promise<EkisRun> {
  const db = await admin();
  const ranAt = new Date().toISOString();
  const last = await db.from("ekis_exports").select("ran_at").eq("tenant_id", tenantId).eq("status", "ok").order("ran_at", { ascending: false }).limit(1).maybeSingle();
  const [people, sets] = await Promise.all([
    db.from("patients").select("id, patient_number, first_name, last_name, date_of_birth, email, phone, street, house_number, house_suffix, postcode, city, country, created_at").eq("tenant_id", tenantId).is("deleted_at", null),
    db.from("answer_sets").select("patient_id, questionnaire_key, status, completed_at, answers").eq("tenant_id", tenantId),
  ]);
  if (people.error) throw people.error;
  if (sets.error) throw sets.error;
  // Patient numbers are stored as big integers; the export and its sorting work on text.
  const peopleRows = (people.data ?? []).map((p) => ({ ...p, patient_number: String(p.patient_number) }));
  const document = buildEkisDocument(peopleRows, (sets.data ?? []) as EkisAnswerSet[], ranAt, last.data?.ran_at ?? null);
  const ins = await db
    .from("ekis_exports")
    .insert({
      tenant_id: tenantId,
      ran_at: ranAt,
      trigger_kind: kind,
      status: "ok",
      patients: document.counts.patients,
      answer_sets: document.counts.answer_sets,
      document: document as unknown as Json,
      error: "",
      created_by: userId,
    })
    .select("id")
    .single();
  if (ins.error) throw ins.error;
  return { id: ins.data.id, ranAt, patients: document.counts.patients, answerSets: document.counts.answer_sets, document };
}

/** What the koppelingen screen shows about the eKis link: last run, counts and the next moment. */
export async function ekisStatus(tenant: Tenant) {
  const db = await admin();
  const { data } = await db.from("ekis_exports").select("ran_at, status, patients, answer_sets, trigger_kind").eq("tenant_id", tenant.id).order("ran_at", { ascending: false }).limit(1).maybeSingle();
  const now = new Date();
  const next = nextExportAt(now, tenant.time_zone);
  return {
    enabled: tenant.ekis_export_enabled,
    last: data ? { ranAt: data.ran_at, status: data.status, patients: data.patients, answerSets: data.answer_sets, kind: data.trigger_kind } : null,
    lastLabel: data ? exportLabel(new Date(data.ran_at), now, tenant.time_zone) : null,
    nextAt: next.toISOString(),
    nextLabel: exportLabel(next, now, tenant.time_zone),
  };
}

export interface LocationStats {
  location: string;
  appointments: number;
  free: number;
  occupancy: number;
  noShows: number;
}
export interface StatsSummary {
  range: { from: string; to: string; days: number };
  totals: { arrivals: number; appointments: number; no_shows: number; no_show_rate: number; occupancy: number };
  per_day: DayCounts[];
  per_source: SourceCount[];
  per_location: LocationStats[];
  per_channel: SourceCount[];per_campaign: SourceCount[];per_link: SourceCount[];
  triage_reasons: Array<{ reason: string; count: number }>;
}

/**
 * Only totals: how a brand books, never a row about one person. The same numbers serve the
 * management dashboard and the public statistics API, so both always agree.
 */
export async function statsSummary(tenant: { id: string; time_zone: string }, days = 30): Promise<StatsSummary> {
  const db = await admin();
  const tz = tenant.time_zone;
  const now = new Date();
  const today = zonedParts(now, tz).date;
  const from = addLocalDays(today, -(Math.max(1, Math.min(365, days)) - 1));
  const [appts, links, blocks, reasons, locations] = await Promise.all([
    db.from("appointments").select("created_at, starts_at, ends_at, status, source, booking_attribution, booking_hash, booking_link_id, referral_source, location_id").eq("tenant_id", tenant.id).neq("status", "released"),
    db.from("booking_links").select("id, source").eq("tenant_id", tenant.id),
    db.from("schedule_blocks").select("practitioner_id, weekday, location_id, starts, ends, recurrence, valid_from, valid_until, treatment_ids").eq("tenant_id", tenant.id),
    db.from("triage_rejection_counts").select("reason, count, day").eq("tenant_id", tenant.id).gte("day", from).lte("day", today),
    db.from("locations").select("id, name, kind, status, sort").eq("tenant_id", tenant.id).order("sort"),
  ]);
  if (appts.error) throw appts.error;
  if (links.error) throw links.error;
  if (blocks.error) throw blocks.error;
  if (reasons.error) throw reasons.error;
  if (locations.error) throw locations.error;

  const dayOf = (iso: string | null) => (iso ? zonedParts(new Date(iso), tz).date : null);
  const rows = (appts.data ?? []).filter((a) => ["booked", "tentatief", "gearriveerd", "in_behandeling", "klaar_voor_betaling", "afgerond", "no_show"].includes(a.status));
  const arrivals = rows.filter((a) => { const d = dayOf(a.created_at); return d !== null && d >= from && d <= today; });
  const inRange = rows.filter((a) => { const d = dayOf(a.starts_at); return d !== null && d >= from && d <= today; });
  const daysList = Array.from({ length: Math.max(1, Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1) }, (_, i) => addLocalDays(from, i));

  const linkSources = new Map((links.data ?? []).map((l) => [l.id, l.source]));
  const countRows: CountRow[] = arrivals.map((a) => ({ source: a.source, referral_source: a.referral_source, booking_link_id: a.booking_link_id }));

  // Today, per location: booked minutes against the time that is on the roster.
  const scheduled = new Map<string, number>();
  for (const b of (blocks.data ?? []) as unknown as SlotBlock[]) {
    if (!blockOn(b, today)) continue;
    scheduled.set(b.location_id, (scheduled.get(b.location_id) ?? 0) + (toMin(b.ends) - toMin(b.starts)));
  }
  const booked = new Map<string, number>();
  const countToday = new Map<string, number>();
  const noShowToday = new Map<string, number>();
  for (const a of rows) {
    if (dayOf(a.starts_at) !== today || !a.location_id) continue;
    const mins = (Date.parse(a.ends_at) - Date.parse(a.starts_at)) / 60_000;
    booked.set(a.location_id, (booked.get(a.location_id) ?? 0) + mins);
    countToday.set(a.location_id, (countToday.get(a.location_id) ?? 0) + 1);
    if (a.status === "no_show") noShowToday.set(a.location_id, (noShowToday.get(a.location_id) ?? 0) + 1);
  }
  const perLocation: LocationStats[] = (locations.data ?? [])
    .filter((l) => l.status === "open")
    .map((l) => ({
      location: l.name,
      appointments: countToday.get(l.id) ?? 0,
      free: Math.max(0, Math.round(((scheduled.get(l.id) ?? 0) - (booked.get(l.id) ?? 0)) / 30)),
      occupancy: occupancy(booked.get(l.id) ?? 0, scheduled.get(l.id) ?? 0),
      noShows: noShowToday.get(l.id) ?? 0,
    }));

  const weekFrom = addLocalDays(today, -6);
  const week = rows.filter((a) => { const d = dayOf(a.starts_at); return d !== null && d >= weekFrom && d <= today; });
  const weekNoShows = week.filter((a) => a.status === "no_show").length;
  const totalsBooked = [...booked.values()].reduce((a, b) => a + b, 0);
  const totalsScheduled = [...scheduled.values()].reduce((a, b) => a + b, 0);
  const reasonTotals = new Map<string, number>();
  for (const r of reasons.data ?? []) reasonTotals.set(r.reason, (reasonTotals.get(r.reason) ?? 0) + r.count);

  return {
    range: { from, to: today, days: daysList.length },
    totals: {
      arrivals: arrivals.length,
      appointments: inRange.length,
      no_shows: weekNoShows,
      no_show_rate: noShowRate(weekNoShows, week.length),
      occupancy: occupancy(totalsBooked, totalsScheduled),
    },
    per_day: perDay(daysList, arrivals.map((a) => ({ day: dayOf(a.created_at) ?? "" })), inRange.map((a) => ({ day: dayOf(a.starts_at) ?? "" }))),
    per_source: bySource(countRows, linkSources),
    per_channel:bySource(arrivals.map(a=>({source:a.booking_attribution&&typeof a.booking_attribution==="object"&&!Array.isArray(a.booking_attribution)?String(a.booking_attribution["channel"]??"Website"):"Website",referral_source:null,booking_link_id:null})),new Map()),
    per_campaign:bySource(arrivals.map(a=>({source:a.booking_attribution&&typeof a.booking_attribution==="object"&&!Array.isArray(a.booking_attribution)?String(a.booking_attribution["campaign"]??"Geen campagne"):"Geen campagne",referral_source:null,booking_link_id:null})),new Map()),
    per_link:bySource(arrivals.map(a=>({source:a.booking_hash??"Zonder boekingslink",referral_source:null,booking_link_id:null})),new Map()),
    per_location: perLocation,
    triage_reasons: [...reasonTotals.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason, "nl")),
  };
}

/** Log one statistics-API call: which key pulled what, and whether it worked. */
export async function logStatsRequest(tenantId: string, endpoint: string, ok: boolean) {
  const db = await admin();
  await db.from("stats_requests").insert({ tenant_id: tenantId, requested_at: new Date().toISOString(), endpoint, ok });
}
