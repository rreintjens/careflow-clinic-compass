import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getExternalBusy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const tenant = await context.supabase.rpc("current_tenant");
  if (tenant.error || !tenant.data) throw new Error("Geen actieve organisatie.");
  const [periods, setting] = await Promise.all([
    context.supabase.from("external_busy_periods").select("*").eq("tenant_id", tenant.data).order("starts_at"),
    context.supabase.from("settings").select("value").eq("tenant_id", tenant.data).eq("key", "ekis_agenda_visible").maybeSingle(),
  ]);
  if (periods.error) throw periods.error;
  if (setting.error) throw setting.error;
  return { periods: periods.data, visible: setting.data?.value !== false, updatedAt: periods.data.map((p) => p.updated_at).sort().at(-1) ?? null };
});
export const setExternalBusyVisible = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ visible: z.boolean() })).handler(async ({ data, context }) => {
  if (!(await context.supabase.rpc("has_permission", { _perm: "settings.edit" })).data) throw new Error("Je hebt geen toegang tot deze instelling.");
  const tenant = await context.supabase.rpc("current_tenant");
  if (tenant.error || !tenant.data) throw new Error("Geen actieve organisatie.");
  const r = await context.supabase.from("settings").update({ value: data.visible }).eq("tenant_id", tenant.data).eq("key", "ekis_agenda_visible");
  if (r.error) throw r.error;
});