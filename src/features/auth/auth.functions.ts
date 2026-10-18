import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isLocked, registerFailure, signInSchema, type LockState } from "@/domain/auth";
import { pickActiveTenant } from "@/domain/tenancy";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function requestMeta() {
  const req = getRequest();
  const ip =
    req?.headers.get("cf-connecting-ip") ??
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null;
  return { ip, userAgent: req?.headers.get("user-agent") ?? null };
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function audit(entry: {
  userId: string | null;
  tenantId?: string | null;
  roleKey?: string | null;
  action: string;
  category: string;
  details?: Record<string, string | number | boolean | null>;
}) {
  const db = await admin();
  const { ip, userAgent } = requestMeta();
  await db.from("audit_log").insert({
    user_id: entry.userId,
    tenant_id: entry.tenantId ?? null,
    role_key: entry.roleKey ?? null,
    action: entry.action,
    category: entry.category,
    record_type: "auth",
    details: entry.details ?? {},
    ip,
    user_agent: userAgent,
  });
}

async function numberSetting(key: string, fallback: number): Promise<number> {
  const db = await admin();
  const { data } = await db.from("group_settings").select("value").eq("key", key).maybeSingle();
  return typeof data?.value === "number" ? data.value : fallback;
}

const GENERIC_ERROR = "Inloggen is niet gelukt. Controleer je gegevens of probeer het later opnieuw.";

/** Password step runs on the server so lockout cannot be bypassed from the browser. */
export const signInStaff = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signInSchema.parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const emailHash = await sha256(data.email);
    const now = new Date();
    const { data: row } = await db
      .from("login_attempts")
      .select("failed_count, locked_until")
      .eq("email_hash", emailHash)
      .maybeSingle();
    const state: LockState | null = row
      ? { failedCount: row.failed_count, lockedUntil: row.locked_until }
      : null;

    if (isLocked(state, now)) {
      await audit({ userId: null, action: "login_failed", category: "login", details: { reason: "locked", email_hash: emailHash } });
      return { ok: false as const, error: GENERIC_ERROR };
    }

    const client = createClient<Database>(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data: auth, error } = await client.auth.signInWithPassword(data);

    let blocked = false;
    let memberships: Array<{ tenantId: string; sort: number; roleKey: string }> = [];
    if (auth?.user) {
      const { data: profile } = await db.from("profiles").select("blocked").eq("id", auth.user.id).maybeSingle();
      const { data: ms } = await db
        .from("tenant_memberships")
        .select("tenant_id, tenants(sort), roles(key)")
        .eq("user_id", auth.user.id);
      memberships = (ms ?? []).map((m) => ({
        tenantId: m.tenant_id,
        sort: (m.tenants as { sort: number } | null)?.sort ?? 0,
        roleKey: (m.roles as { key: string } | null)?.key ?? "",
      }));
      // A group admin sits above the organisations: no membership needed, every tenant is reachable.
      const { data: ga } = await db.from("group_admins").select("user_id").eq("user_id", auth.user.id).maybeSingle();
      if (ga) {
        const { data: all } = await db.from("tenants").select("id, sort");
        const known = new Set(memberships.map((m) => m.tenantId));
        for (const t of all ?? []) if (!known.has(t.id)) memberships.push({ tenantId: t.id, sort: t.sort, roleKey: "superadmin" });
      }
      blocked = !profile || profile.blocked || memberships.length === 0;
    }

    if (error || !auth.session || blocked) {
      const [max, minutes] = await Promise.all([numberSetting("lockout_attempts", 5), numberSetting("lockout_minutes", 15)]);
      const next = registerFailure(state, now, max, minutes);
      await db.from("login_attempts").upsert({
        email_hash: emailHash,
        failed_count: next.failedCount,
        locked_until: next.lockedUntil,
        updated_at: now.toISOString(),
      });
      await audit({
        userId: auth?.user?.id ?? null,
        action: "login_failed",
        category: "login",
        details: { reason: blocked ? "blocked" : "credentials", email_hash: emailHash },
      });
      if (auth?.session) await client.auth.signOut();
      return { ok: false as const, error: GENERIC_ERROR };
    }

    await db.from("login_attempts").delete().eq("email_hash", emailHash);

    // The active tenant lives in the signed JWT (app_metadata), written only here and by switchTenant.
    const meta = (auth.user.app_metadata ?? {}) as Record<string, unknown>;
    const current = typeof meta["active_tenant"] === "string" ? (meta["active_tenant"] as string) : null;
    const active = pickActiveTenant(memberships, current);
    let session = auth.session;
    if (active !== current) {
      await db.auth.admin.updateUserById(auth.user.id, { app_metadata: { ...meta, active_tenant: active } });
      const refreshed = await client.auth.refreshSession({ refresh_token: session.refresh_token });
      if (refreshed.data.session) session = refreshed.data.session;
    }
    const roleKey = memberships.find((m) => m.tenantId === active)?.roleKey ?? null;
    await audit({ userId: auth.user.id, tenantId: active, roleKey, action: "login", category: "login" });
    return {
      ok: true as const,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    };
  });

/** Records mfa_verified (only when the token really is aal2) and logout. */
export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ action: z.enum(["mfa_verified", "logout"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const aal = (context.claims as { aal?: string }).aal;
    if (data.action === "mfa_verified" && aal !== "aal2") throw new Error("Not verified");
    const meta = (context.claims as { app_metadata?: { active_tenant?: string } }).app_metadata;
    const { data: role } = await context.supabase.rpc("current_role_key");
    await audit({ userId: context.userId, tenantId: meta?.active_tenant ?? null, roleKey: role ?? null, action: data.action, category: "login" });
    return { ok: true };
  });

/** Switches the active tenant: membership is checked, the claim is written server-side, and the switch is logged. */
export const switchTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ tenantId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: mine, error } = await context.supabase.rpc("my_tenants");
    if (error) throw new Error("Wisselen is niet gelukt");
    const target = (mine ?? []).find((t) => t.tenant_id === data.tenantId);
    if (!target) throw new Error("Geen toegang tot deze organisatie");
    const db = await admin();
    const { data: u } = await db.auth.admin.getUserById(context.userId);
    const meta = (u.user?.app_metadata ?? {}) as Record<string, unknown>;
    const from = typeof meta["active_tenant"] === "string" ? (meta["active_tenant"] as string) : null;
    await db.auth.admin.updateUserById(context.userId, { app_metadata: { ...meta, active_tenant: data.tenantId } });
    await audit({ userId: context.userId, tenantId: from, action: "tenant_switched_out", category: "login", details: { to: target.slug } });
    await audit({ userId: context.userId, tenantId: data.tenantId, action: "tenant_switched_in", category: "login", details: { to: target.slug } });
    return { ok: true, slug: target.slug };
  });
