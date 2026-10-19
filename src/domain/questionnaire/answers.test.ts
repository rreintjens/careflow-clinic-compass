import { describe, expect, it } from "vitest";
import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";
import { answerSignals, answerText } from "./answers";
import { makeCtx, redOnPage, visiblePages, type FlowFile } from "./engine";

const flow = seed as unknown as FlowFile;
const triage = flow.questionnaires.find((q) => q.id === "triage");
const eva = { date_of_birth: "1985-05-12", sex: "Vrouw", origin: ["Geen van deze"], height_cm: 170, weight_kg: 80, comorbidities: ["Geen van deze"], waist_cm: 95, conditions: ["Geen van deze"], men2: "Bij geen van hen", mental: "Geen van deze" };

describe("Eva's frozen-version intake", () => {
  it("keeps BMI 27.7, no condition and waist 95 green with a waist signal", () => {
    if (!triage) throw new Error("Missing triage fixture");
    const ctx = makeCtx(flow, eva, "2026-10-19");
    expect(Number(Number(ctx.computed["bmi"]).toFixed(1))).toBe(27.7);
    expect(visiblePages(triage, ctx).map((p) => redOnPage(triage, p, ctx)).filter(Boolean)).toEqual([]);
    expect(answerSignals(triage, flow, eva, "2026-10-19").map((s) => s.item)).toEqual(["waist_cm"]);
  });
  it("renders all ten stored fields in nine questions in original order", () => {
    if (!triage) throw new Error("Missing triage fixture");
    const items = triage.pages.flatMap((p) => p.items ?? []).filter((i) => answerText(i, eva));
    expect(items.map((i) => i.id)).toEqual(["date_of_birth", "sex", "origin", "height_weight", "comorbidities", "waist_cm", "conditions", "men2", "mental"]);
  });
  it("does not borrow altered live waist thresholds", () => {
    if (!triage) throw new Error("Missing triage fixture");
    const changed = { ...flow, settings: { ...flow.settings, waist_cm: { female_min: 100, male_min: 102 } } };
    expect(answerSignals(triage, changed, eva, "2026-10-19").some((s) => s.item === "waist_cm")).toBe(false);
    expect(answerSignals(triage, flow, eva, "2026-10-19").some((s) => s.item === "waist_cm")).toBe(true);
  });
});