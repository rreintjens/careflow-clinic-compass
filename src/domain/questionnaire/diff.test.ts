import { describe, expect, it } from "vitest";
import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";
import { shortName } from "./builder";
import { changesSentence, describeChanges } from "./diff";
import type { FlowFile, QuestionnaireDef } from "./engine";

const triage = (seed as unknown as FlowFile).questionnaires[0] as QuestionnaireDef;
const clone = () => JSON.parse(JSON.stringify(triage)) as QuestionnaireDef;
const item = (d: QuestionnaireDef, id: string) => d.pages.flatMap((p) => p.items ?? []).find((i) => i.id === id)!;

describe("what changes for the patient", () => {
  it("reports nothing for an identical concept", () => {
    expect(describeChanges(triage, clone())).toEqual([]);
    expect(changesSentence([])).toMatch(/^Niets/);
  });
  it("names a new option on vraag 7", () => {
    const d = clone();
    item(d, "comorbidities").options!.push("Jicht");
    expect(describeChanges(triage, d)).toEqual(["vraag 7 krijgt de optie “jicht”"]);
  });
  it("names a changed visibility rule of vraag 8", () => {
    const d = clone();
    const p = d.pages.find((x) => x.items?.some((i) => i.id === "waist_cm"))!;
    delete p.show_if;
    expect(describeChanges(triage, d)).toContain("de voorwaarde van vraag 8 is gewijzigd");
  });
  it("names a removed question", () => {
    const d = clone();
    d.pages = d.pages.filter((p) => !p.items?.some((i) => i.id === "comorbidities"));
    expect(describeChanges(triage, d).some((c) => c.startsWith("de vraag “Heb je een van deze aandoeningen"))).toBe(true);
  });
});

describe("short question names for titles", () => {
  it.each([
    ["Heb je een van deze aandoeningen die met je gewicht samenhangen?", "aandoeningen"],
    ["Wat is je buikomvang?", "buikomvang"],
    ["Gebruik je afslankmedicatie?", "afslankmedicatie"],
  ])("%s → %s", (text, name) => expect(shortName(text)).toBe(name));
});
