/**
 * RLS deny-by-default proof on the classified identity table `patients`.
 * Signs in as each seeded test role, reaches aal2 by enrolling a temporary TOTP
 * factor, probes select/insert/delete, then removes the factor again.
 *
 * Runs only when TEST_STAFF_PASSWORD, SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are set:
 *   TEST_STAFF_PASSWORD=... bunx vitest run src/test/rls-patients.integration.test.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

import type { Database } from "@/integrations/supabase/types";
import { totp } from "./totp";

const URL = process.env["SUPABASE_URL"] ?? "";
const KEY = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
const PASSWORD = process.env["TEST_STAFF_PASSWORD"] ?? "";
const enabled = Boolean(URL && KEY && PASSWORD);

type Client = SupabaseClient<Database>;
const PROBE_EMAIL = "rls-probe@example.test";

function newClient(): Client {
  return createClient<Database>(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(email: string, aal2: boolean): Promise<{ client: Client; factorId?: string }> {
  const client = newClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  if (!aal2) return { client };
  const existing = await client.auth.mfa.listFactors();
  for (const f of existing.data?.all ?? []) {
    if (f.status === "unverified") await client.auth.mfa.unenroll({ factorId: f.id });
  }
  const verified = existing.data?.totp.find((f) => f.friendly_name === "rls-test");
  if (verified) throw new Error("left-over rls-test factor; remove it first");
  const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: "rls-test" });
  if (enroll.error) throw enroll.error;
  const factorId = enroll.data.id;
  const ch = await client.auth.mfa.challenge({ factorId });
  if (ch.error) throw ch.error;
  const v = await client.auth.mfa.verify({
    factorId,
    challengeId: ch.data.id,
    code: totp(enroll.data.totp.secret),
  });
  if (v.error) throw v.error;
  return { client, factorId };
}

async function probe(client: Client) {
  const sel = await client.from("patients").select("id");
  const ins = await client
    .from("patients")
    .insert({ first_name: "RLS", last_name: "Probe", date_of_birth: "1990-01-01", email: PROBE_EMAIL })
    .select("id");
  const del = await client.from("patients").delete().eq("email", PROBE_EMAIL).select("id");
  return {
    select: (sel.data ?? []).length,
    insert: !ins.error && (ins.data ?? []).length > 0,
    delete: !del.error && (del.data ?? []).length > 0,
  };
}

const cleanup: Array<() => Promise<unknown>> = [];

// Expected per role, from the "Rollen en rechten" matrix.
const matrix: Array<{ email: string; insert: boolean; delete: boolean }> = [
  { email: "superadmin@example.test", insert: true, delete: true },
  { email: "admin@example.test", insert: true, delete: false },
  { email: "arts@example.test", insert: false, delete: false },
  { email: "therapeut@example.test", insert: false, delete: false },
  { email: "customer-care@example.test", insert: true, delete: false },
  { email: "assistent@example.test", insert: true, delete: false },
];

describe.skipIf(!enabled)("RLS on patients (deny by default)", () => {
  afterAll(async () => {
    for (const fn of cleanup) await fn();
  });

  it("anonymous visitor sees nothing and cannot write", async () => {
    const r = await probe(newClient());
    expect(r).toEqual({ select: 0, insert: false, delete: false });
  });

  for (const row of matrix) {
    it(`${row.email} without 2FA (aal1) is denied everything`, async () => {
      const { client } = await signIn(row.email, false);
      const r = await probe(client);
      expect(r).toEqual({ select: 0, insert: false, delete: false });
      await client.auth.signOut();
    });

    it(`${row.email} with 2FA follows the permission matrix`, async () => {
      const { client, factorId } = await signIn(row.email, true);
      cleanup.push(async () => {
        if (factorId) await client.auth.mfa.unenroll({ factorId });
      });
      const r = await probe(client);
      expect(r.select).toBeGreaterThan(0);
      expect(r.insert).toBe(row.insert);
      // delete only removes the probe row this role inserted (or none)
      expect(r.delete).toBe(row.delete && row.insert);
      if (r.insert && !r.delete) {
        // leave no probe rows behind: superadmin removes them at the end
        cleanup.push(async () => {
          const su = await signIn("superadmin@example.test", true);
          await su.client.from("patients").delete().eq("email", PROBE_EMAIL);
          if (su.factorId) await su.client.auth.mfa.unenroll({ factorId: su.factorId });
        });
      }
    });
  }
});
