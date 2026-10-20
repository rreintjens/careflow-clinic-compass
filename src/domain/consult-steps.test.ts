import { describe, expect, it } from "vitest";
import { closeChecklist, emptyStepData, fiscalAnswersComplete, gpLetterText, lineTotal, nextPharmacyStatus, prefillStepData, readStepData } from "./consult-steps";
import { emptyContent } from "./dossier-templates";

const botox = { ...emptyContent(), steps: ["medische_status", "anamnese", "behandeling", "afronden"], controle: ["L10", "L11"], bespreekpunt: [], diagnoses: [] };
const ma = { ...emptyContent(), steps: ["medische_status", "anamnese", "diagnose", "plan_recept", "afronden"], diagnoses: ["E66.0"], bespreekpunt: ["L14", "L15"] };

describe("consult steps", () => {
  it('requires every fiscal question before recording a decision', () => {
    expect(fiscalAnswersComplete(['L12', 'L13'], { L12: 'ja' })).toBe(false);
    expect(fiscalAnswersComplete(['L12', 'L13'], { L12: 'ja', L13: 'nee' })).toBe(true);
  });
  it("prefills diagnoses, aftercare and reminder from the template", () => {
    const d = prefillStepData({ ...ma, aftercare: "Rustig aan", patientNote: "Welkom", reminderDays: 90 });
    expect(d.diagnoses).toEqual(["E66.0"]);
    expect(d.closing.aftercare).toBe("Rustig aan");
    expect(d.closing.reminderDays).toBe(90);
  });
  it("reads partial step data with defaults", () => {
    const d = readStepData({ diagnoses: ["E11"] });
    expect(d.diagnoses).toEqual(["E11"]);
    expect(d.transcript.status).toBe("idle");
  });
  it("builds the close checklist from the template's required items", () => {
    const items = closeChecklist(botox, { ...emptyStepData(), lines: [{ treatmentId: "t", name: "Botox", qty: 1, unit: "zones", priceCents: 14500, lot: null }], libraryAnswers: { L10: "ja" } }, { prescriptionSigned: null, photoCount: 0, soepFilled: 4 });
    const by = Object.fromEntries(items.map((i) => [i.key, i.done]));
    expect(by["lotnummer"]).toBe(false);
    expect(by["fotos"]).toBe(false);
    expect(by["controlevragen"]).toBe(false);
    expect(by["soep"]).toBe(true);
    expect(items.some((i) => i.key === "recept")).toBe(false);
  });
  it("requires the transcript to be reviewed once used", () => {
    const d = { ...emptyStepData(), transcript: { status: "proposal" as const, proposal: "x" } };
    expect(closeChecklist(ma, d, { prescriptionSigned: true, photoCount: 0, soepFilled: 4 }).find((i) => i.key === "verslag")?.done).toBe(false);
  });
  it("requires all bespreekpunten answered", () => {
    const d = { ...emptyStepData(), discussed: { L14: { answer: "ja" as const, by: "u", at: "t" } } };
    expect(closeChecklist(ma, d, { prescriptionSigned: true, photoCount: 0, soepFilled: 4 }).find((i) => i.key === "bespreekpunten")?.done).toBe(false);
  });
  it("fills the GP letter placeholders", () => {
    expect(gpLetterText("Patiënt {patient}, {behandeling} op {datum}.", { patient: "Sanne", datum: "20 okt", behandeling: "Botox", diagnose: "", medicatie: "", arts: "Hugo" })).toBe("Patiënt Sanne, Botox op 20 okt.");
  });
  it("walks the pharmacy statuses in order", () => {
    expect(nextPharmacyStatus("verstuurd")).toBe("ontvangen");
    expect(nextPharmacyStatus("klaargezet")).toBe("verzonden");
    expect(nextPharmacyStatus("verzonden")).toBeNull();
  });
  it("sums treatment lines", () => {
    expect(lineTotal([{ treatmentId: "t", name: "Botox", qty: 2, unit: "zones", priceCents: 14500, lot: null }])).toBe(29000);
  });
});
