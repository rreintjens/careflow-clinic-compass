import { describe, expect, it } from "vitest";
import { blockVisible, interpolate, mailTemplateSchema, resolveMail, safeMailUrl, translated, type MailTemplate } from "./mail";

const base = { id: "base", moment: "confirmation", scope: "base", status: "active", category_id: null, treatment_id: null } as MailTemplate;
const category = { ...base, id: "category", scope: "category", category_id: "laser" };
const treatment = { ...base, id: "treatment", scope: "treatment", treatment_id: "ontharing" };
describe("mail resolution", () => {
  it.each([
    { rows: [base, category, treatment], expected: "treatment" },
    { rows: [base, category], expected: "category" },
    { rows: [base], expected: "base" },
    { rows: [base, { ...treatment, status: "draft" }], expected: "base" },
    { rows: [{ ...treatment, treatment_id: "other" }, base], expected: "base" },
  ])("selects $expected", ({ rows, expected }) => { expect(resolveMail(rows, "confirmation", "ontharing", ["laser"])?.id).toBe(expected); });
  it("does not use another moment", () => { expect(resolveMail([base], "cancelled", "ontharing", [])).toBeNull(); });
  it("falls back to Dutch when English is missing", () => { expect(translated("Nederlands", "", "en")).toBe("Nederlands"); });
  it("uses English when supplied", () => { expect(translated("Nederlands", "English", "en")).toBe("English"); });
});
describe("mail conditions", () => {
  const situation = { online: true, existingPatient: false, questionnaire: true, preparation: false };
  it.each([["always", true], ["online", true], ["clinic", false], ["new_patient", true], ["existing_patient", false], ["questionnaire", true], ["preparation", false], ["unknown", false]])("%s → %s", (condition, visible) => { expect(blockVisible(String(condition), situation)).toBe(visible); });
  it("interpolates treatment fields without losing unknown placeholders", () => { expect(interpolate("{voorbereiding} {nazorg}", { voorbereiding: "Scheer vooraf" })).toBe("Scheer vooraf {nazorg}"); });
  it.each(["javascript:alert(1)", "data:text/html,x", "http://example.com"])("rejects unsafe link %s", (url) => { expect(safeMailUrl(url)).toBeNull(); });
  it("accepts secure links", () => { expect(safeMailUrl("https://bodyclinic.nl")).toBe("https://bodyclinic.nl"); });
  it("cannot activate an empty template", () => { expect(mailTemplateSchema.safeParse({ id: null, name: "Test", moment: "confirmation", scope: "base", category_id: null, treatment_id: null, status: "active", subject_nl: "", subject_en: "", description: "", blocks: [] }).success).toBe(false); });
});