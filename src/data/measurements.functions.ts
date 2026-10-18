import { createServerFn } from "@tanstack/react-start";
import { measurementSchema } from "@/domain/measurements";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => measurementSchema.parse(input))
  .handler(async ({ data, context }) => {
    const claims = context.claims as { aal?: string };
    if (claims.aal !== "aal2") throw new Error("Forbidden");
    const result = await context.supabase.from("measurements").insert({ patient_id: data.patientId, measured_on: data.date, weight_kg: data.weight, height_cm: data.height, waist_cm: data.waist, bp_systolic: data.sys, bp_diastolic: data.dia, pulse: data.pulse }).select("id").single();
    if (result.error) throw new Error("Saving failed");
    return { id: result.data.id };
  });