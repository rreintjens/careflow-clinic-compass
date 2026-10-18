import { describe, expect, it } from "vitest";

import { buildEkisDocument, exportLabel, exportWindow, nextExportAt, type EkisAnswerSet, type EkisPatient } from "./ekis";

const patient = (over: Partial<EkisPatient> & { id: string; patient_number: string; created_at: string }): EkisPatient => ({
  first_name: "Ada",
  last_name: "Test",
  date_of_birth: "1990-05-05",
  email: "ada@example.test",
  phone: "0612345678",
  street: "Hoofdstraat",
  house_number: "12",
  house_suffix: null,
  postcode: "1234AB",
  city: "Amsterdam",
  country: "NL",
  ...over,
});
const set = (over: Partial<EkisAnswerSet> & { patient_id: string }): EkisAnswerSet => ({
  questionnaire_key: "medisch_afvallen",
  status: "completed",
  completed_at: "2026-10-17T09:00:00Z",
  answers: {},
  ...over,
});

const EXPORTED = "2026-10-18T04:00:00Z"; // 06:00 in Amsterdam in October

describe("exportWindow", () => {
  it("starts at the previous run", () => {
    expect(exportWindow("2026-10-17T04:00:00Z", EXPORTED)).toEqual({ from: "2026-10-17T04:00:00Z", to: EXPORTED });
  });
  it("takes everything the first time", () => {
    expect(exportWindow(null, EXPORTED).from).toBe("0001-01-01T00:00:00Z");
  });
});

describe("buildEkisDocument", () => {
  const patients = [
    patient({ id: "p2", patient_number: "1000002", created_at: "2026-10-17T05:00:00Z" }),
    patient({ id: "p1", patient_number: "1000001", created_at: "2026-10-17T04:30:00Z" }),
    patient({ id: "p0", patient_number: "1000000", created_at: "2026-10-16T04:30:00Z" }), // before the window
  ];
  const sets = [
    set({ patient_id: "p1", questionnaire_key: "triage", completed_at: "2026-10-17T04:40:00Z", answers: { bmi: 27 } }),
    set({ patient_id: "p1", questionnaire_key: "medisch_afvallen", completed_at: "2026-10-17T05:10:00Z", answers: { lithium: "nee" } }),
    set({ patient_id: "p9", questionnaire_key: "medisch_afvallen", answers: {} }), // patient not in the window
  ];

  it("lists the new patients by number with their answers", () => {
    const doc = buildEkisDocument(patients, sets, EXPORTED, "2026-10-17T04:00:00Z");
    expect(doc.patients.map((p) => p.patient_number)).toEqual(["1000001", "1000002"]);
    expect(doc.patients[0]?.questionnaires.map((q) => q.questionnaire_key)).toEqual(["triage", "medisch_afvallen"]);
    expect(doc.patients[1]?.questionnaires).toEqual([]);
  });
  it("counts patients and answer sets, and never leaks an answer of another patient", () => {
    const doc = buildEkisDocument(patients, sets, EXPORTED, "2026-10-17T04:00:00Z");
    expect(doc.counts).toEqual({ patients: 2, answer_sets: 2 });
    expect(JSON.stringify(doc)).not.toContain("p9");
  });
  it("carries the patient's own fields, without the internal id", () => {
    const doc = buildEkisDocument(patients, sets, EXPORTED, "2026-10-17T04:00:00Z");
    expect(doc.patients[0]?.patient).toMatchObject({ postcode: "1234AB", city: "Amsterdam" });
    expect(doc.patients[0]?.patient["id"]).toBeUndefined();
    expect(doc.format).toBe("tbc-ekis-1");
    expect(doc.exported_at).toBe(EXPORTED);
  });
});

const utc = (d: Date) => d.toISOString().replace(".000Z", "Z");

describe("nextExportAt", () => {
  it("is today at 06:00 while it has not run yet", () => {
    const now = new Date("2026-10-18T03:00:00Z"); // 05:00 in Amsterdam
    expect(utc(nextExportAt(now, "Europe/Amsterdam"))).toBe("2026-10-18T04:00:00Z");
  });
  it("is tomorrow at 06:00 just after a run", () => {
    const now = new Date("2026-10-18T04:00:30Z");
    expect(utc(nextExportAt(now, "Europe/Amsterdam"))).toBe("2026-10-19T04:00:00Z");
  });
  it("keeps 06:00 local across the summer/winter change", () => {
    expect(utc(nextExportAt(new Date("2026-03-29T03:00:00Z"), "Europe/Amsterdam"))).toBe("2026-03-29T04:00:00Z"); // 06:00 CEST
    expect(utc(nextExportAt(new Date("2026-10-25T04:00:00Z"), "Europe/Amsterdam"))).toBe("2026-10-25T05:00:00Z"); // 06:00 CET
  });
});

describe("exportLabel", () => {
  const now = new Date("2026-10-18T05:00:00Z");
  it("says vandaag, morgen or the date", () => {
    expect(exportLabel(new Date("2026-10-18T04:00:00Z"), now, "Europe/Amsterdam")).toBe("vandaag 06:00");
    expect(exportLabel(new Date("2026-10-19T04:00:00Z"), now, "Europe/Amsterdam")).toBe("morgen 06:00");
    expect(exportLabel(new Date("2026-10-21T04:00:00Z"), now, "Europe/Amsterdam")).toBe("21 oktober 06:00");
  });
});
