import { expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import type { Dossier } from "@/data/patients";
import type { Database } from "@/integrations/supabase/types";

it("includes the patient's stored measurement in the treatment timeline", () => {
  const dossier: Dossier = { patient: { id: "patient", patient_number: 1000003, first_name: "Test", last_name: "Patient", date_of_birth: "1988-03-14", email: "test@example.test", phone: null, tenant_id: "tenant", city: null, country: null, created_at: "2026-10-18T00:22:00Z", created_by: null, updated_at: "2026-10-18T00:22:00Z", updated_by: null, deleted_at: null, deleted_reason: null, gp_name: null, house_number: null, house_suffix: null, phone_country: null, postcode: null, salutation: null, street: null, labels: [], online_booking_blocked: false }, appointments: [], sets: [] };
  const measurement: Database["public"]["Tables"]["measurements"]["Row"] = {
    id: "test", patient_id: "patient", tenant_id: "tenant", appointment_id: null,
    measured_on: "2026-10-18", weight_kg: 110, height_cm: 180, waist_cm: 95,
    bp_systolic: 120, bp_diastolic: 90, pulse: 70, source: "staff", created_at: "2026-10-18T00:22:00Z",
    updated_at: "2026-10-18T00:22:00Z", created_by: null, updated_by: null,
  };
  const events = buildTimeline(dossier, [], [measurement]);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ kind: "treatment", at: "2026-10-18T00:22:00Z" });
  expect(events[0]?.body).toContain("110 kg");
  expect(events[0]?.body).toContain("BMI 34,0");
  expect(events[0]?.body).toContain("120/90");
});