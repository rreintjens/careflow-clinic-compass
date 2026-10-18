/**
 * Staff side of the koppelingen screen and the management dashboard. Every action first checks the
 * session (MFA + permission) through the caller's own client; only then does a privileged client
 * write, and only for the brand the session belongs to. Changing a brand row is group-admin only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "./booking.server";
import { ekisStatus, hashStatsKey, runEkisExport, statsSummary, tenantById } from "./integrations.server";

type Supabase = import("@supabase/supabase-js").SupabaseClient;
type Ctx = { supabase: Supabase; claims: { aal?: string; sub?: string } };

/** The brand of this session, or a refusal when the session has no active brand. */
async function activeTenant(ctx: Ctx) {
  const tenantId = (await ctx.supabase.rpc("current_tenant")).data as string | null;
  const tenant = tenantId ? await tenantById(tenantId) : null;
  if (!tenant) throw new Error("Geen actieve organisatie");
  return tenant;
}

async function allowed(ctx: Ctx, perm: string) {
  const { data, error } = await ctx.supabase.rpc("has_permission", { _perm: perm });
  if (error || !data) throw new Error("Forbidden");
}

/** A statistics key is shown once, right after it is made; the database only keeps its hash. */
function newStatsKey() {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `tbc_${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const getKoppelingen = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.view");
    const tenant = await activeTenant(ctx);
    const db = await admin();
    const [ekis, links, lastStats, lastMeet, groupAdmin] = await Promise.all([
      ekisStatus(tenant),
      db.from("booking_links").select("id, name, source, status").eq("tenant_id", tenant.id),
      db.from("stats_requests").select("requested_at, ok").eq("tenant_id", tenant.id).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("appointments").select("meet_link_created_at, patient_id").eq("tenant_id", tenant.id).not("meet_link", "is", null).order("meet_link_created_at", { ascending: false }).limit(1).maybeSingle(),
      ctx.supabase.rpc("is_group_admin"),
    ]);
    const active = (links.data ?? []).filter((l) => l.status === "active");
    const usage = new Map<string, number>();
    for (const a of (await db.from("appointments").select("booking_link_id").eq("tenant_id", tenant.id).not("booking_link_id", "is", null)).data ?? []) {
      if (a.booking_link_id) usage.set(a.booking_link_id, (usage.get(a.booking_link_id) ?? 0) + 1);
    }
    const mostUsed = active.map((l) => ({ name: l.name, count: usage.get(l.id) ?? 0 })).sort((a, b) => b.count - a.count)[0];
    return {
      meet: { account: tenant.google_meet_account, active: !!tenant.google_meet_account, lastLinkAt: lastMeet.data?.meet_link_created_at ?? null },
      ekis,
      mail: { sender: tenant.mail_sender, verified: tenant.mail_sender_verified },
      stats: { keySet: !!tenant.stats_key_hash, lastUsedAt: lastStats.data?.requested_at ?? null },
      bookingLinks: { active: active.length, mostUsed: mostUsed && mostUsed.count > 0 ? mostUsed.name : null },
      groupAdmin: !!groupAdmin.data,
    };
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.view");
    const tenant = await activeTenant(ctx);
    const db = await admin();
    const summary = await statsSummary(tenant, 30);
    const today = summary.range.to;
    const [appts, patients, treatments, categories, links, completed, lastStats] = await Promise.all([
      db.from("appointments").select("patient_id, treatment_id, starts_at, status, location_id, created_at").eq("tenant_id", tenant.id).neq("status", "released").neq("status", "cancelled").gte("starts_at", `${today}T00:00:00Z`),
      db.from("patients").select("id, created_at").eq("tenant_id", tenant.id).is("deleted_at", null),
      db.from("treatments").select("id, pre_questionnaire_key").eq("tenant_id", tenant.id),
      db.from("treatment_categories").select("id, name_nl, sort").eq("tenant_id", tenant.id).order("sort"),
      db.from("treatment_category_links").select("treatment_id, category_id").eq("tenant_id", tenant.id),
      db.from("answer_sets").select("patient_id, questionnaire_key").eq("tenant_id", tenant.id).eq("status", "completed"),
      db.from("stats_requests").select("requested_at").eq("tenant_id", tenant.id).order("requested_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (appts.error) throw appts.error;
    if (patients.error) throw patients.error;
    if (treatments.error) throw treatments.error;
    if (categories.error) throw categories.error;
    if (links.error) throw links.error;
    if (completed.error) throw completed.error;

    const { zonedParts } = await import("@/domain/time");
    const dayOf = (iso: string | null) => (iso ? zonedParts(new Date(iso), tenant.time_zone).date : null);
    const newPatientDays = new Set((patients.data ?? []).map((p) => dayOf(p.created_at)));
    const preKey = new Map((treatments.data ?? []).map((t) => [t.id, t.pre_questionnaire_key]));
    const done = new Set((completed.data ?? []).map((a) => `${a.patient_id}|${a.questionnaire_key}`));
    const categoryOf = new Map((links.data ?? []).map((l) => [l.treatment_id, l.category_id]));
    const categoryName = new Map((categories.data ?? []).map((c) => [c.id, c.name_nl]));

    const openFor = (a: { patient_id: string | null; treatment_id: string | null }) => {
      const key = a.treatment_id ? preKey.get(a.treatment_id) ?? null : null;
      return !a.patient_id || !key || !done.has(`${a.patient_id}|${key}`);
    };
    const todayRows = (appts.data ?? []).filter((a) => dayOf(a.starts_at) === today);
    const laterRows = (appts.data ?? []).filter((a) => { const d = dayOf(a.starts_at); return d !== null && d > today; });

    const groups = new Map<string, { appointments: number; newPatients: number; openQuestionnaires: number }>();
    for (const a of todayRows) {
      const name = (a.treatment_id ? categoryOf.get(a.treatment_id) : null) ? categoryName.get(categoryOf.get(a.treatment_id)!) ?? "Overig" : "Overig";
      const g = groups.get(name) ?? { appointments: 0, newPatients: 0, openQuestionnaires: 0 };
      g.appointments += 1;
      if (a.patient_id && newPatientDays.has(dayOf((patients.data ?? []).find((p) => p.id === a.patient_id)?.created_at ?? null) ?? "")) g.newPatients += 1;
      if (openFor(a)) g.openQuestionnaires += 1;
      groups.set(name, g);
    }
    const avg = summary.per_day.length ? Math.round((summary.totals.arrivals / summary.per_day.length) * 10) / 10 : 0;
    return {
      today: {
        date: today,
        arrivals: (appts.data ?? []).filter((a) => dayOf(a.created_at) === today).length,
        appointments: todayRows.length,
        occupancy: summary.totals.occupancy,
        openQuestionnaires: todayRows.filter(openFor).length,
        openLater: laterRows.filter(openFor).length,
        noShowsWeek: summary.totals.no_shows,
        noShowRate: summary.totals.no_show_rate,
        avgArrivals: avg,
      },
      perLocation: summary.per_location,
      perGroup: [...groups.entries()].map(([group, g]) => ({ group, ...g })).sort((a, b) => b.appointments - a.appointments),
      perSource: summary.per_source,
      lastStatsAt: lastStats.data?.requested_at ?? null,
      statsKeySet: !!tenant.stats_key_hash,
    };
  });

/** "Nu exporteren": one run now, with the same file the scheduler would have made. */
export const runEkisNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.edit");
    const tenant = await activeTenant(ctx);
    const run = await runEkisExport(tenant.id, "manual", ctx.claims.sub ?? null);
    return { patients: run.patients, answerSets: run.answerSets, ranAt: run.ranAt };
  });

/** The one account that makes the calendar appointment and Meet link for every online visit. */
export const setMeetAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ account: z.string().trim().email("Vul een geldig e-mailadres in.").max(160) }))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.edit");
    const { data: isGroup, error } = await ctx.supabase.rpc("is_group_admin");
    if (error || !isGroup) throw new Error("Alleen een groepsbeheerder kan het gekoppelde account wijzigen.");
    const tenant = await activeTenant(ctx);
    const db = await admin();
    const { error: updateError } = await db.from("tenants").update({ google_meet_account: data.account }).eq("id", tenant.id);
    if (updateError) throw new Error("Opslaan is niet gelukt.");
    return { account: data.account };
  });

/** The file the last export made, so the staff screen can offer it as a download. */
export const downloadEkisFile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.view");
    const tenant = await activeTenant(ctx);
    const db = await admin();
    const { data } = await db.from("ekis_exports").select("ran_at, document").eq("tenant_id", tenant.id).eq("status", "ok").order("ran_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) throw new Error("Er is nog geen export gemaakt.");
    return { ranAt: data.ran_at, document: data.document };
  });

/** A new statistics key; the old one stops working the moment this returns. */
export const rotateStatsKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as unknown as Ctx;
    if (ctx.claims.aal !== "aal2") throw new Error("Forbidden");
    await allowed(ctx, "settings.edit");
    const { data: isGroup, error } = await ctx.supabase.rpc("is_group_admin");
    if (error || !isGroup) throw new Error("Alleen een groepsbeheerder kan de sleutel vernieuwen.");
    const tenant = await activeTenant(ctx);
    const key = newStatsKey();
    const db = await admin();
    const { error: updateError } = await db.from("tenants").update({ stats_key_hash: hashStatsKey(key) }).eq("id", tenant.id);
    if (updateError) throw new Error("De sleutel is niet vernieuwd.");
    return { key };
  });
