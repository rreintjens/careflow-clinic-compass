import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; userId: string };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Caller must hold roles.manage in the active tenant; returns that tenant. */
async function manager(ctx: Ctx) {
  const { data: ok } = await ctx.supabase.rpc("has_permission", { _perm: "users.manage" });
  if (!ok) throw new Error("Forbidden");
  const { data: tenant } = await ctx.supabase.rpc("current_tenant");
  if (!tenant) throw new Error("Forbidden");
  return tenant as string;
}

async function testMode(tenantId: string) {
  const db = await admin();
  const { data } = await db.from("settings").select("value").eq("tenant_id", tenantId).eq("key", "test_mode").maybeSingle();
  return data?.value === true;
}

function generatePassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

async function log(ctx: Ctx, tenantId: string, action: string, category: string, details: Record<string, unknown>, record?: { type: string; id: string }) {
  const db = await admin();
  const req = getRequest();
  const { data: role } = await ctx.supabase.rpc("current_role_key");
  await db.from("audit_log").insert({
    user_id: ctx.userId, tenant_id: tenantId, role_key: (role as string | null) ?? null, action, category,
    record_type: record?.type ?? null, record_id: record?.id ?? null, details: details as never,
    ip: req?.headers.get("cf-connecting-ip") ?? req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    user_agent: req?.headers.get("user-agent") ?? null,
  });
}

/** Would this change leave the tenant without an active superadmin? */
async function leavesNoSuperadmin(tenantId: string, userId: string, next: { roleId?: string | undefined; active?: boolean | undefined; blocked?: boolean | undefined }) {
  const db = await admin();
  const { data: su } = await db.from("roles").select("id").eq("tenant_id", tenantId).eq("key", "superadmin").maybeSingle();
  if (!su) return false;
  const { data: ms } = await db.from("tenant_memberships").select("user_id, role_id, active, profiles:user_id(blocked)").eq("tenant_id", tenantId).eq("role_id", su.id);
  const live = (ms ?? []).filter((m) => m.active && !(m.profiles as { blocked?: boolean } | null)?.blocked);
  if (!live.some((m) => m.user_id === userId)) return false;
  const stays = (next.roleId === undefined || next.roleId === su.id) && next.active !== false && next.blocked !== true;
  return !stays && live.length <= 1;
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  role_id: z.string().uuid(),
  practitioner_id: z.string().uuid().nullable(),
  active: z.boolean(),
});

/** New staff account: in test mode created directly with a one-time generated password; otherwise invited by e-mail. */
export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tenantId = await manager(context);
    const db = await admin();
    const { data: role } = await db.from("roles").select("id").eq("id", data.role_id).eq("tenant_id", tenantId).maybeSingle();
    if (!role) return { ok: false as const, error: "Kies een rol van deze organisatie." };
    const { data: existing } = await db.from("profiles").select("id").ilike("email", data.email).maybeSingle();
    let userId = existing?.id as string | undefined;
    let password: string | null = null;
    if (!userId) {
      if (await testMode(tenantId)) {
        password = generatePassword();
        const r = await db.auth.admin.createUser({ email: data.email, password, email_confirm: true, user_metadata: { full_name: data.full_name } });
        if (r.error || !r.data.user) return { ok: false as const, error: "Aanmaken is niet gelukt." };
        userId = r.data.user.id;
      } else {
        const r = await db.auth.admin.inviteUserByEmail(data.email, { data: { full_name: data.full_name } });
        if (r.error || !r.data.user) return { ok: false as const, error: "Uitnodigen is niet gelukt." };
        userId = r.data.user.id;
      }
      await db.from("profiles").insert({ id: userId, full_name: data.full_name, email: data.email });
    }
    const { data: has } = await db.from("tenant_memberships").select("id").eq("tenant_id", tenantId).eq("user_id", userId).maybeSingle();
    if (has) return { ok: false as const, error: "Deze gebruiker hoort al bij deze organisatie." };
    const m = await db.from("tenant_memberships").insert({ tenant_id: tenantId, user_id: userId, role_id: data.role_id, active: data.active });
    if (m.error) return { ok: false as const, error: "Aanmaken is niet gelukt." };
    if (data.practitioner_id) await db.from("practitioners").update({ user_id: userId }).eq("id", data.practitioner_id).eq("tenant_id", tenantId);
    await log(context, tenantId, "user_created", "created", { name: data.full_name, invited: !password }, { type: "user", id: userId });
    return { ok: true as const, password, invited: !password };
  });

const updateSchema = z.object({
  user_id: z.string().uuid(),
  role_id: z.string().uuid().optional(),
  active: z.boolean().optional(),
  blocked: z.boolean().optional(),
  practitioner_id: z.string().uuid().nullable().optional(),
});

/** Role, active, blocked and practitioner link; never leaves the organisation without a superadmin. */
export const updateStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const tenantId = await manager(context);
    const db = await admin();
    const { data: m } = await db.from("tenant_memberships").select("id, role_id, active").eq("tenant_id", tenantId).eq("user_id", data.user_id).maybeSingle();
    if (!m) return { ok: false as const, error: "Deze gebruiker hoort niet bij deze organisatie." };
    if (data.user_id === context.userId && (data.active === false || data.blocked === true || (data.role_id && data.role_id !== m.role_id)))
      return { ok: false as const, error: "Je kunt je eigen account niet deactiveren, blokkeren of een andere rol geven." };
    if (await leavesNoSuperadmin(tenantId, data.user_id, { roleId: data.role_id, active: data.active, blocked: data.blocked }))
      return { ok: false as const, error: "Er moet altijd minstens één actieve superadmin blijven." };
    if (data.role_id) {
      const { data: role } = await db.from("roles").select("id").eq("id", data.role_id).eq("tenant_id", tenantId).maybeSingle();
      if (!role) return { ok: false as const, error: "Kies een rol van deze organisatie." };
    }
    const patch: { role_id?: string; active?: boolean } = {};
    if (data.role_id) patch.role_id = data.role_id;
    if (data.active !== undefined) patch.active = data.active;
    if (Object.keys(patch).length) {
      const r = await db.from("tenant_memberships").update(patch).eq("id", m.id);
      if (r.error) return { ok: false as const, error: "Opslaan is niet gelukt." };
    }
    if (data.blocked !== undefined) await db.from("profiles").update({ blocked: data.blocked }).eq("id", data.user_id);
    if (data.practitioner_id !== undefined) {
      await db.from("practitioners").update({ user_id: null }).eq("tenant_id", tenantId).eq("user_id", data.user_id);
      if (data.practitioner_id) await db.from("practitioners").update({ user_id: data.user_id }).eq("id", data.practitioner_id).eq("tenant_id", tenantId);
    }
    const what = data.blocked !== undefined ? (data.blocked ? "user_blocked" : "user_unblocked") : data.active !== undefined ? (data.active ? "user_activated" : "user_deactivated") : "user_changed";
    await log(context, tenantId, what, "changed", { role_id: data.role_id ?? null }, { type: "user", id: data.user_id });
    return { ok: true as const };
  });

/** Test mode: new generated password shown once. Otherwise a reset e-mail. */
export const resetStaffPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const tenantId = await manager(context);
    const db = await admin();
    const { data: m } = await db.from("tenant_memberships").select("id").eq("tenant_id", tenantId).eq("user_id", data.user_id).maybeSingle();
    if (!m) return { ok: false as const, error: "Deze gebruiker hoort niet bij deze organisatie." };
    let password: string | null = null;
    if (await testMode(tenantId)) {
      password = generatePassword();
      const r = await db.auth.admin.updateUserById(data.user_id, { password });
      if (r.error) return { ok: false as const, error: "Resetten is niet gelukt." };
    } else {
      const { data: p } = await db.from("profiles").select("email").eq("id", data.user_id).maybeSingle();
      if (!p?.email) return { ok: false as const, error: "Resetten is niet gelukt." };
      const r = await db.auth.resetPasswordForEmail(p.email);
      if (r.error) return { ok: false as const, error: "Resetten is niet gelukt." };
    }
    await log(context, tenantId, "password_reset", "changed", {}, { type: "user", id: data.user_id });
    return { ok: true as const, password };
  });

/** One 'viewed' row per staff page; a patient record view also records the patient number. */
export const logPageView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ route: z.string().min(1).max(300).startsWith("/") }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: tenant } = await context.supabase.rpc("current_tenant");
    if (!tenant) return { ok: false };
    const db = await admin();
    const seg = data.route.match(/^\/patienten\/([^/?#]+)(?:\/([^/?#]+))?/);
    let details: Record<string, unknown> = { route: data.route };
    let record: { type: string; id: string } | undefined;
    if (seg?.[1]) {
      const key = seg[1];
      const q = db.from("patients").select("id, patient_number").eq("tenant_id", tenant as string);
      const { data: p } = await (/^\d+$/.test(key) ? q.eq("patient_number", Number(key)) : /^[0-9a-f-]{36}$/.test(key) ? q.eq("id", key) : q.eq("id", "00000000-0000-0000-0000-000000000000")).maybeSingle();
      if (p) { details = { ...details, patient_number: String(p.patient_number), tab: seg[2] ?? "overzicht" }; record = { type: "patients", id: p.id }; }
    }
    await log(context, tenant as string, "viewed", "viewed", details, record);
    return { ok: true };
  });
