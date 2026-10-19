import { describe, expect, it } from "vitest";
import { standaloneConsultSchema, consultTiming, isOtherPatientRecord } from "./consult";

describe("Eva's consult", () => {
  const patient = { id: "eva-uuid", patient_number: 1000007 };
  it("recognizes the same patient number and UUID on every record tab", () => {
    expect(isOtherPatientRecord("/patienten/1000007/medisch", patient)).toBe(false);
    expect(isOtherPatientRecord("/patienten/eva-uuid", patient)).toBe(false);
    expect(isOtherPatientRecord("/patienten/1000008", patient)).toBe(true);
  });
  it("has no remaining-consult countdown before the next day's 11:00 appointment", () => {
    expect(consultTiming("2026-10-20T09:00:00Z", "2026-10-20T09:30:00Z", Date.parse("2026-10-19T15:55:00Z"))).toMatchObject({ phase: "upcoming", minutesLeft: null, progress: 0 });
  });
  it("uses minutes until start within the hour", () => {
    expect(consultTiming("2026-10-20T09:00:00Z", "2026-10-20T09:30:00Z", Date.parse("2026-10-20T08:40:00Z"))).toMatchObject({ minutesUntil: 20, minutesLeft: null });
  });
  it("starts the remaining countdown at the start time", () => {
    expect(consultTiming("2026-10-20T09:00:00Z", "2026-10-20T09:30:00Z", Date.parse("2026-10-20T09:00:00Z"))).toMatchObject({ phase: "started", minutesLeft: 30 });
  });
});

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