import { createServerFn } from "@tanstack/react-start";
import { standaloneConsultSchema } from "@/domain/consult";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveStandaloneConsult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => standaloneConsultSchema.parse(input))
  .handler(async ({ data, context }) => {
    const claims = context.claims as { aal?: string };
    if (claims.aal !== "aal2") throw new Error("Forbidden");
    const { data: allowed, error: permissionError } = await context.supabase.rpc("has_permission", { _perm: "patients.medical" });
    if (permissionError || !allowed) throw new Error("Forbidden");
    const [patient, practitioner, options] = await Promise.all([
      context.supabase.from("patients").select("id").eq("id", data.patientId).maybeSingle(),
      context.supabase.from("practitioners").select("id").eq("id", data.practitionerId).eq("status", "active").maybeSingle(),
      context.supabase.from("option_lists").select("list_key, value").in("list_key", ["standalone_consult_kind", "standalone_consult_follow_up", "standalone_consult_visibility"]),
    ]);
    if (patient.error || !patient.data || practitioner.error || !practitioner.data || options.error) throw new Error("Forbidden");
    for (const [key, value] of [["standalone_consult_kind", data.kind], ["standalone_consult_follow_up", data.followUp], ["standalone_consult_visibility", data.visibility]]) {
      if (!options.data?.some((option) => option.list_key === key && option.value === value)) throw new Error("Invalid selection");
    }
    const result = await context.supabase.from("consult_notes").insert({
      patient_id: data.patientId, appointment_id: null, kind: data.kind, practitioner_id: data.practitionerId,
      occurred_at: `${data.date}T12:00:00Z`, time_and_duration: data.timeAndDuration,
      reason: data.reason, subjective: data.subjective, objective: data.objective, evaluation: data.evaluation, plan: data.plan,
      follow_up: data.followUp, visibility: data.visibility, status: "final", finished_at: new Date().toISOString(),
    }).select("id").single();
    if (result.error) throw new Error("Saving failed");
    return { id: result.data.id };
  });