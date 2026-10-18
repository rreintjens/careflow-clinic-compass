import { describe, expect, it } from "vitest";
import { standaloneConsultSchema } from "./consult";

const input = {
  patientId: "1ff9599e-6bf7-4e06-9ea0-4d07c74a81b2", kind: "telephone",
  practitionerId: "11111111-1111-4111-8111-111111111111", date: "2026-10-20",
  timeAndDuration: "11:40, 10 minuten", reason: "Test", subjective: "Test",
  objective: "", evaluation: "", plan: "", followUp: "already_planned", visibility: "practitioners",
};

describe("standalone consult design fields", () => {
  it("accepts an unscheduled telephone consult without an appointment", () => {
    expect(standaloneConsultSchema.parse(input)).toMatchObject({ kind: "telephone", timeAndDuration: "11:40, 10 minuten" });
  });
  it.each(["2026-02-30", "2026-13-01", "not-a-date"])("rejects invalid consultation date %s", (date) => {
    expect(standaloneConsultSchema.safeParse({ ...input, date }).success).toBe(false);
  });
  it("requires a practitioner chosen from the list", () => {
    expect(standaloneConsultSchema.safeParse({ ...input, practitionerId: "Feikje" }).success).toBe(false);
  });
});