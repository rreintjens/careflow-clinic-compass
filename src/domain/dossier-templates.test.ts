import { describe, expect, it } from "vitest";
import { conceptMessage, emptyContent, libraryItem, mergeTemplates, nextCode, questionnaireCodes, syncDefinition, templateUsesCode } from "./dossier-templates";

const q = { code: "L07", text_nl: "Ben je zwanger?", qtype: "yes_no", grp: "anamnese", options: [], condition: { field: "sex_at_birth", equals: "female" } };

describe("dossier templates", () => {
  it("merges templates deduplicated by library code", () => {
    const a = { ...emptyContent(), steps: ["anamnese", "afronden"], anamnese: ["L01", "L02"] };
    const b = { ...emptyContent(), steps: ["anamnese", "behandeling"], anamnese: ["L02", "L05"], reminderDays: 120 };
    const m = mergeTemplates([a, b]);
    expect(m.anamnese).toEqual(["L01", "L02", "L05"]);
    expect(m.steps).toEqual(["anamnese", "afronden", "behandeling"]);
    expect(m.reminderDays).toBe(120);
  });
  it("names the concepts a library change creates", () => {
    expect(conceptMessage(3, 1)).toBe("Wijzigen maakt een concept van 3 sjablonen en 1 vragenlijst");
    expect(conceptMessage(0, 0)).toBeNull();
  });
  it("detects use and syncs linked questionnaire items", () => {
    expect(templateUsesCode({ ...emptyContent(), controle: ["L07"] }, "L07")).toBe(true);
    const def = { pages: [{ id: "p", items: [libraryItem(q, "x"), { id: "y", type: "text" as const, text: "Los" }] }] };
    expect(questionnaireCodes(def)).toEqual(["L07"]);
    const synced = syncDefinition(def, { ...q, text_nl: "Ben je zwanger of geef je borstvoeding?" });
    expect(synced.pages[0]!.items![0]!.text).toBe("Ben je zwanger of geef je borstvoeding?");
    expect(synced.pages[0]!.items![1]!.text).toBe("Los");
  });
  it("keeps the condition on a library item", () => expect(libraryItem(q, "x").show_if).toEqual({ all: [{ field: "sex_at_birth", op: "eq", value: "female" }] }));
  it("gives the next L-code", () => expect(nextCode(["L01", "L16"])).toBe("L17"));
});
