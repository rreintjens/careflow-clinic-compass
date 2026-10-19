import { describe, expect, it } from "vitest";
import { describeAudit, toCsv } from "./audit";

const row = (p: Partial<Parameters<typeof describeAudit>[0]>) => ({ action: "", category: "viewed", record_type: null, record_id: null, details: {}, user_id: "u1", ...p });

describe("logbook lines in plain Dutch", () => {
  it("record view names the patient number and links to the record", () => {
    expect(describeAudit(row({ action: "viewed", details: { route: "/patienten/1000123", patient_number: "1000123", tab: "overzicht" } })))
      .toEqual({ actor: "u1", text: "heeft het dossier van patiënt 1000123 bekeken.", link: "/patienten/1000123" });
  });
  it("medical tab view", () => {
    expect(describeAudit(row({ action: "viewed", details: { route: "/patienten/1000123/medisch", patient_number: "1000123", tab: "medisch" } })).text).toBe("heeft de medische gegevens van patiënt 1000123 bekeken.");
  });
  it("staff page view", () => {
    expect(describeAudit(row({ action: "viewed", details: { route: "/agenda/mijn-dag" } })).text).toBe("heeft Mijn dag bekeken.");
  });
  it("table changes never show the table name or ids", () => {
    const l = describeAudit(row({ action: "appointments_update", category: "changed", record_type: "appointments", record_id: "9bc9dfe2-88c4-474c-b7ad-54606a9b8192" }));
    expect(l.text).toBe("heeft gewijzigd: een afspraak.");
    expect(l.text).not.toMatch(/appointments|9bc9/);
  });
  it("csv quotes fields", () => expect(toCsv([["a\"b", "c"]])).toBe('"a""b";"c"'));
});
