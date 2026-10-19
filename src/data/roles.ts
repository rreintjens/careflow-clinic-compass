import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export const rolesQuery = queryOptions({
  queryKey: ["roles"],
  queryFn: async () => {
    const [roles, perms, rp, users] = await Promise.all([
      supabase.from("roles").select("*").order("sort"),
      supabase.from("permissions").select("*").order("sort"),
      supabase.from("role_permissions").select("role_id, permission_key"),
      supabase.rpc("current_tenant").then((t) => supabase.from("tenant_memberships").select("user_id, role_id, active").eq("tenant_id", t.data ?? "")),
    ]);
    for (const r of [roles, perms, rp, users]) if (r.error) throw r.error;
    return { roles: roles.data ?? [], permissions: perms.data ?? [], rolePermissions: rp.data ?? [], userRoles: users.data ?? [] };
  },
});

export const usersQuery = queryOptions({
  queryKey: ["users"],
  queryFn: async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name, email, blocked").order("full_name");
    if (error) throw error;
    return data;
  },
});

export const LANDING_OPTIONS = [
  { value: "dashboard", label: "Dashboard" },
  { value: "mijn-dag", label: "Mijn dag" },
  { value: "agenda", label: "Agenda" },
  { value: "patienten", label: "Patiënten" },
] as const;

export const CONSULT_OPTIONS = [
  { value: "yes", label: "Ja" },
  { value: "yes_counter_panel", label: "Ja, met teller en notitiepaneel" },
  { value: "yes_no_medical_signals", label: "Ja, zonder medische signalen van medisch afvallen" },
  { value: "no", label: "Nee" },
] as const;

export const SCOPE_LABELS: Record<string, string> = { all: "Alle", own: "Eigen afspraken" };

export async function saveRolePermissions(add: Array<{ role_id: string; permission_key: string }>, remove: Array<{ role_id: string; permission_key: string }>) {
  if (add.length) {
    const { error } = await supabase.from("role_permissions").insert(add);
    if (error) throw error;
  }
  for (const r of remove) {
    const { error } = await supabase.from("role_permissions").delete().eq("role_id", r.role_id).eq("permission_key", r.permission_key);
    if (error) throw error;
  }
}

export const practitionerLinksQuery = queryOptions({
  queryKey: ["practitioner-links"],
  queryFn: async () => (await supabase.from("practitioners").select("id, first_name, last_name, user_id").order("first_name")).data ?? [],
});

export async function updateRole(id: string, patch: { name?: string; landing_page: string; consult_mode: string; record_visibility?: string }) {
  const { error } = await supabase.from("roles").update(patch).eq("id", id);
  if (error) throw error;
}

export async function createRole(r: { name: string; landing_page: string; consult_mode: string; record_visibility: string; sort: number }) {
  const key = r.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rol";
  const { data, error } = await supabase.from("roles").insert({ ...r, key: `${key}-${Date.now().toString(36)}`, patient_scope: "all" }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteRole(id: string) {
  const { error: e1 } = await supabase.from("role_permissions").delete().eq("role_id", id);
  if (e1) throw e1;
  const { error } = await supabase.from("roles").delete().eq("id", id);
  if (error) throw error;
}
