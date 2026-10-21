import type { SupabaseClient } from "@supabase/supabase-js";
import {afterAll,describe,expect,it,vi} from "vitest";
import type {Database} from "@/integrations/supabase/types";
import {databaseClient,testRoleSession,integrationEnabled} from "./database-client";
vi.setConfig({testTimeout:30000,hookTimeout:30000});
type Client=SupabaseClient<Database>;
const PROBE_EMAIL="rls-probe@example.test";
const enabled=integrationEnabled;
const newClient=()=>databaseClient();
async function signIn(email:string,_aal2:boolean){return testRoleSession(email);}

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
  // superadmin is not probed: its only factor is the owner's own authenticator.
  { email: "admin@example.test", insert: true, delete: false },
  { email: "arts@example.test", insert: false, delete: false },
  { email: "therapeut@example.test", insert: false, delete: false },
  { email: "customer-care@example.test", insert: true, delete: false },
  { email: "assistent@example.test", insert: true, delete: false },
];

describe.skipIf(!enabled)("RLS on patients (deny by default)", () => {
  afterAll(async () => {
    for (const fn of cleanup) await fn();
    const deleted=await databaseClient(true).from("patients").delete().eq("email",PROBE_EMAIL);
    if(deleted.error)throw deleted.error;
  });

  it("anonymous visitor sees nothing and cannot write", async () => {
    const r = await probe(newClient());
    expect(r).toEqual({ select: 0, insert: false, delete: false });
  });

  for (const row of matrix) {
    it(`${row.email} test mode permits aal1 per permission matrix`, async () => {
      const { client } = await signIn(row.email, false);
      const r = await probe(client);
      expect(r.select).toBeGreaterThan(0);
      expect(r.insert).toBe(row.insert);
      expect(r.delete).toBe(row.delete && row.insert);
      await client.auth.signOut();
    });

    it(`${row.email} authenticated session follows the permission matrix`, async () => {
      const {client}=await signIn(row.email,true);
      const r = await probe(client);
      expect(r.select).toBeGreaterThan(0);
      expect(r.insert).toBe(row.insert);
      // delete only removes the probe row this role inserted (or none)
      expect(r.delete).toBe(row.delete && row.insert);
      if (r.insert && !r.delete) {
        // leave no probe rows behind: removed with the service key at the end
        cleanup.push(async () => {
          const svc=databaseClient(true);
          await svc.from("patients").delete().eq("email", PROBE_EMAIL);
        });
      }
    });
  }
});
