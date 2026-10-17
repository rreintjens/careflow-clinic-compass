/**
 * Tenancy acceptance (03_MULTI_TENANT.md §8) and the RLS matrix: every role against every
 * tenant table, in two tenants. Each signed-in client reaches aal2 with a temporary TOTP factor
 * that is removed afterwards. The active tenant is set the way switchTenant does it
 * (app_metadata.active_tenant via the admin API, then a token refresh).
 *
 *   TEST_STAFF_PASSWORD=… bunx vitest run src/test/tenancy.integration.test.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 90_000, hookTimeout: 90_000 });

import type { Database } from "@/integrations/supabase/types";
import { totp } from "./totp";

const URL = process.env["SUPABASE_URL"] ?? "";
const KEY = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
const PASSWORD = process.env["TEST_STAFF_PASSWORD"] ?? "";
const enabled = Boolean(URL && KEY && SERVICE && PASSWORD);

type Client = SupabaseClient<Database>;
type Table = keyof Database["public"]["Tables"];

const TENANT_TABLES: Table[] = [
  "roles", "role_permissions", "settings", "holidays", "patients", "practitioner_roles", "locations",
  "location_hours", "location_exceptions", "rooms", "equipment", "equipment_day_locations",
  "equipment_exceptions", "equipment_kinds", "equipment_types", "equipment_schedule", "treatment_categories", "treatments", "treatment_category_links",
  "treatment_practitioner_roles", "treatment_locations", "treatment_requirements", "practitioners",
  "practitioner_languages", "practitioner_locations", "practitioner_treatments", "schedule_blocks",
  "schedule_exceptions", "audit_log",
];

// Expected from the "Rollen en rechten" matrix: who may write organisation config / see the log.
const ROLES = [
  // superadmin is not in the matrix: its only factor is the owner's own authenticator.
  { email: "admin@example.test", config: true, log: true },
  { email: "arts@example.test", config: false, log: false },
  { email: "therapeut@example.test", config: false, log: false },
  { email: "customer-care@example.test", config: false, log: false },
  { email: "assistent@example.test", config: false, log: false },
] as const;

const admin = () =>
  createClient<Database>(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const anonClient = () =>
  createClient<Database>(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const tenants: Record<string, string> = {};
const factors: Array<{ client: Client; id: string }> = [];
const restore: Array<() => Promise<unknown>> = [];

async function setActiveTenant(userId: string, tenantId: string) {
  const db = admin();
  const { data } = await db.auth.admin.getUserById(userId);
  await db.auth.admin.updateUserById(userId, {
    app_metadata: { ...(data.user?.app_metadata ?? {}), active_tenant: tenantId },
  });
}

const sessions = new Map<string, { client: Client; userId: string }>();

/** One aal2 session per account per run (a second enrolment would need aal2 itself). */
async function signIn(email: string, tenantSlug: string): Promise<Client> {
  const known = sessions.get(email);
  if (known) {
    await switchTo(known.client, known.userId, tenantSlug);
    return known.client;
  }
  const client = anonClient();
  const s = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (s.error) throw s.error;
  const userId = s.data.user.id;
  const original = (s.data.user.app_metadata as { active_tenant?: string }).active_tenant;
  restore.push(() => setActiveTenant(userId, original ?? tenants["tbc-nl"]!));
  const enroll = await client.auth.mfa.enroll({ factorType: "totp", friendlyName: `tenancy-${Date.now()}` });
  if (enroll.error) throw enroll.error;
  factors.push({ client, id: enroll.data.id });
  const ch = await client.auth.mfa.challenge({ factorId: enroll.data.id });
  if (ch.error) throw ch.error;
  const v = await client.auth.mfa.verify({ factorId: enroll.data.id, challengeId: ch.data.id, code: totp(enroll.data.totp.secret) });
  if (v.error) throw v.error;
  sessions.set(email, { client, userId });
  await switchTo(client, userId, tenantSlug);
  return client;
}

async function switchTo(client: Client, userId: string, slug: string) {
  await setActiveTenant(userId, tenants[slug]!);
  const r = await client.auth.refreshSession();
  if (r.error) throw r.error;
}

async function uid(client: Client) {
  return (await client.auth.getUser()).data.user!.id;
}

/** Tenant ids of all rows the client can read in a table. */
async function visibleTenants(client: Client, table: Table): Promise<string[]> {
  const { data, error } = await client.from(table).select("tenant_id").limit(1000);
  if (error) return [];
  return Array.from(new Set((data as unknown as Array<{ tenant_id: string }>).map((r) => r.tenant_id)));
}

describe.skipIf(!enabled)("tenancy (03_MULTI_TENANT §8)", () => {
  beforeAll(async () => {
    const { data } = await admin().from("tenants").select("id, slug");
    for (const t of data ?? []) tenants[t.slug] = t.id;
  });
  afterAll(async () => {
    for (const f of factors.splice(0)) await f.client.auth.mfa.unenroll({ factorId: f.id });
    for (const fn of restore.splice(0).reverse()) await fn();
    sessions.clear();
    await admin().from("patients").delete().like("email", "tenancy-probe-%");
  });

  it("two tenants exist and a two-tenant user never sees the other tenant's rows (every table)", async () => {
    expect(tenants["tbc-nl"]).toBeTruthy();
    expect(tenants["tbc-de"]).toBeTruthy();
    const c = await signIn("admin@example.test", "tbc-nl");
    const me = await uid(c);
    for (const t of TENANT_TABLES) {
      const seen = await visibleTenants(c, t);
      expect(seen.every((x) => x === tenants["tbc-nl"]), `${t} in NL`).toBe(true);
    }
    // insert in A (DE), read as B (NL) returns nothing
    await switchTo(c, me, "tbc-de");
    const ins = await c.from("patients").insert({ first_name: "Probe", last_name: "DE", date_of_birth: "1990-01-01", email: "tenancy-probe-de@example.test" }).select("id, tenant_id").single();
    expect(ins.error).toBeNull();
    expect(ins.data?.tenant_id).toBe(tenants["tbc-de"]);
    for (const t of TENANT_TABLES) {
      const seen = await visibleTenants(c, t);
      expect(seen.every((x) => x === tenants["tbc-de"]), `${t} in DE`).toBe(true);
    }
    await switchTo(c, me, "tbc-nl");
    const back = await c.from("patients").select("id").eq("id", ins.data!.id);
    expect(back.data ?? []).toHaveLength(0);
    // writing into the other tenant explicitly is refused
    const cross = await c.from("treatments").insert({ slug: "x-cross", name_nl: "Cross", duration_min: 15, tenant_id: tenants["tbc-de"]! });
    expect(cross.error).not.toBeNull();
  });

  it("unknown booking host resolves to no tenant; known hosts resolve to their own tenant", async () => {
    const a = anonClient();
    const unknown = await a.rpc("resolve_tenant_by_host", { _host: "evil.example.com" });
    expect(unknown.data ?? []).toHaveLength(0);
    const nl = await a.rpc("resolve_tenant_by_host", { _host: "boek.bodyclinic.nl" });
    expect(nl.data?.[0]?.slug).toBe("tbc-nl");
    const de = await a.rpc("resolve_tenant_by_host", { _host: "termin.bodyclinic.de" });
    expect(de.data?.[0]?.slug).toBe("tbc-de");
  });

  it("patient numbers run independently per tenant (start at 1000001)", async () => {
    const db = admin();
    const ins = await db.from("patients").insert({ tenant_id: tenants["obesitas-apotheek"]!, first_name: "Probe", last_name: "OA", date_of_birth: "1990-01-01", email: "tenancy-probe-oa@example.test" }).select("patient_number").single();
    expect(ins.data?.patient_number).toBe(1000001);
    const nl = await db.from("patients").select("patient_number").eq("tenant_id", tenants["tbc-nl"]!).order("patient_number", { ascending: false }).limit(1);
    expect(nl.data?.[0]?.patient_number).toBeGreaterThanOrEqual(1000001);
  });

  it("an audit row written in tenant A is invisible in tenant B's Logboek", async () => {
    const c = await signIn("admin@example.test", "tbc-de");
    const me = await uid(c);
    const ins = await c.from("patients").insert({ first_name: "Probe", last_name: "Audit", date_of_birth: "1990-01-01", email: "tenancy-probe-audit@example.test" }).select("id").single();
    expect(ins.error).toBeNull();
    const inDe = await c.from("audit_log").select("id").eq("record_id", ins.data!.id);
    expect((inDe.data ?? []).length).toBeGreaterThan(0);
    await switchTo(c, me, "tbc-nl");
    const inNl = await c.from("audit_log").select("id").eq("record_id", ins.data!.id);
    expect(inNl.data ?? []).toHaveLength(0);
  });

  it("a group_admin without a tenant role cannot read any patient row in any tenant", async () => {
    for (const slug of ["tbc-nl", "tbc-de", "obesitas-apotheek"]) {
      const c = await signIn("group-admin@example.test", slug);
      const p = await c.from("patients").select("id");
      expect(p.data ?? []).toHaveLength(0);
      const t = await c.from("tenants").select("slug");
      expect((t.data ?? []).length).toBe(3);
    }
  });
});

describe.skipIf(!enabled)("RLS matrix: every role × every tenant table × two tenants", () => {
  beforeAll(async () => {
    const { data } = await admin().from("tenants").select("id, slug");
    for (const t of data ?? []) tenants[t.slug] = t.id;
  });
  afterAll(async () => {
    for (const f of factors.splice(0)) await f.client.auth.mfa.unenroll({ factorId: f.id });
    for (const fn of restore.splice(0).reverse()) await fn();
    sessions.clear();
    await admin().from("treatments").delete().like("slug", "rls-matrix-%");
  });

  it("anonymous visitor reads nothing in any tenant table", async () => {
    const a = anonClient();
    for (const t of TENANT_TABLES) {
      const { data } = await a.from(t).select("tenant_id").limit(1);
      expect(data ?? [], t).toHaveLength(0);
    }
  });

  for (const role of ROLES) {
    it(`${role.email}: own tenant only, writes per matrix; no membership in DE means nothing`, async () => {
      const c = await signIn(role.email, "tbc-nl");
      const me = await uid(c);
      for (const t of TENANT_TABLES) {
        const seen = await visibleTenants(c, t);
        expect(seen.every((x) => x === tenants["tbc-nl"]), `${t}`).toBe(true);
      }
      const log = await c.from("audit_log").select("id").limit(1);
      expect((log.data ?? []).length > 0, "logbook").toBe(role.log);
      const slug = `rls-matrix-${role.email.split("@")[0]}`;
      const w = await c.from("treatments").insert({ slug, name_nl: "RLS", duration_min: 15 }).select("id");
      expect(!w.error && (w.data ?? []).length > 0, "config write").toBe(role.config);

      if (role.email !== "admin@example.test") {
        await switchTo(c, me, "tbc-de");
        for (const t of TENANT_TABLES) {
          const { data } = await c.from(t).select("tenant_id").limit(1);
          expect(data ?? [], `${t} in DE without membership`).toHaveLength(0);
        }
      }
    });
  }
});
