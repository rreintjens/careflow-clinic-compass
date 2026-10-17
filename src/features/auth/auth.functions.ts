import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { isLocked, registerFailure, signInSchema, type LockState } from "@/domain/auth";

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
  action: string;
  category: string;
  details?: Record<string, string | number | boolean | null>;
}) {
  const db = await admin();
  const { ip, userAgent } = requestMeta();
  await db.from("audit_log").insert({
    user_id: entry.userId,
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
  const { data } = await db.from("settings").select("value").eq("key", key).maybeSingle();
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
    if (auth?.user) {
      const { data: profile } = await db.from("profiles").select("blocked").eq("id", auth.user.id).maybeSingle();
      blocked = !profile || profile.blocked;
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
    await audit({ userId: auth.user.id, action: "login", category: "login" });
    return {
      ok: true as const,
      accessToken: auth.session.access_token,
      refreshToken: auth.session.refresh_token,
    };
  });

/** Records mfa_verified (only when the token really is aal2) and logout. */
export const logAuthEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ action: z.enum(["mfa_verified", "logout"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const aal = (context.claims as { aal?: string }).aal;
    if (data.action === "mfa_verified" && aal !== "aal2") throw new Error("Not verified");
    await audit({ userId: context.userId, action: data.action, category: "login" });
    return { ok: true };
  });
