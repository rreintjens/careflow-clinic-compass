import { describe, expect, it } from "vitest";

import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";

import { evalCondition, makeCtx, toggleOption, type Condition, type FlowFile, type Item } from "./engine";
import { sameJson } from "./io";
import { fromSituations, isSimpleRed, redAnswers, redRuleFor, toSituations } from "./situations";

const flow = seed as unknown as FlowFile;
type Found = { where: string; c: Condition };
const conditions: Found[] = [];
for (const q of flow.questionnaires) for (const p of q.pages) {
  for (const k of ["show_if", "red_if"] as const) if (p[k]) conditions.push({ where: `${p.id}.${k}`, c: p[k] as Condition });
  for (const i of p.items ?? []) for (const k of ["show_if", "red_if", "signal_if"] as const) {
    const v = i[k];
    if (v && typeof v === "object" && !Array.isArray(v)) conditions.push({ where: `${i.id}.${k}`, c: v as Condition });
  }
}

/** Sample answers that hit every branch: BMI from 17 to 33, both sexes, regions, waist known/unknown, choices. */
const samples = (() => {
  const out: Record<string, unknown>[] = [];
  for (const w of [52, 70, 76, 82, 88, 95]) for (const sex of ["Man", "Vrouw"]) for (const origin of [["Geen van deze"], ["Oost- of Zuidoost-Aziatisch"]])
    for (const waist of [70, 95, 110, "unknown"]) for (const yn of ["yes", "no"])
      out.push({ height_cm: 178, weight_kg: w, sex, origin, waist_cm: waist, date_of_birth: "1988-03-14", comorbidities: yn === "yes" ? ["Geen van deze"] : ["Slaapapneu"], conditions: yn === "yes" ? ["Geen van deze"] : ["Ernstig hartfalen"], burden: yn === "yes" ? "Ja, ik ervaar veel last" : "Nee", higher_weight_past: yn, weightloss_meds_now: yn === "yes" ? "Nee" : "Ja", men2: yn === "yes" ? "Bij geen van hen" : "Bij mijzelf", mental: yn === "yes" ? "Geen van deze" : "Verslaving", blood_test: yn, diets: yn, "triage.sex": sex });
  return out;
})();

describe("condition ↔ situations mapping", () => {
  it("finds the seed conditions", () => expect(conditions.length).toBeGreaterThan(20));

  it.each(conditions)("$where keeps its meaning after a round trip", ({ c }) => {
    const back = fromSituations(toSituations(c));
    for (const a of samples) {
      const ctx = makeCtx(flow, a, "2026-10-19");
      expect(evalCondition(back, ctx)).toBe(evalCondition(c, ctx));
    }
  });

  it.each(conditions.filter(({ c }) => [...(c.all ?? []), ...(c.any ?? [])].every((x) => "field" in x)))("$where comes back identical", ({ c }) => {
    expect(sameJson(fromSituations(toSituations(c)), c)).toBe(true);
  });

  it("reads gte + lt on one field as 'ligt tussen'", () => {
    const s = toSituations({ all: [{ field: "bmi", op: "gte", value: 25 }, { field: "bmi", op: "lt", value: 30 }] });
    expect(s).toEqual([[{ field: "bmi", op: "between", value: 25, value2: 30 }]]);
  });

  it("splits a nested 'of' into two situations", () => {
    const s = toSituations({ all: [{ field: "a", op: "eq", value: 1 }, { any: [{ field: "b", op: "eq", value: 2 }, { field: "c", op: "eq", value: 3 }] }] });
    expect(s.length).toBe(2);
    expect(s[1]?.map((r) => r.field)).toEqual(["a", "c"]);
  });

  it("no rows means no condition", () => expect(fromSituations([[]])).toBeUndefined());
});

describe("per-answer outcome", () => {
  const cond: Item = { id: "conditions", text: "", type: "multi_choice", options: ["Hart", "Lever"], exclusive_option: "Geen van deze", red_if: { all: [{ field: "conditions", op: "not_eq", value: ["Geen van deze"] }] } };
  it("seed rule 'is niet geen van deze' reads as all aandoeningen red", () => {
    expect(isSimpleRed(cond)).toBe(true);
    expect(redAnswers(cond)).toEqual(["Hart", "Lever"]);
    expect(redRuleFor(cond, ["Hart", "Lever"])).toEqual(cond.red_if);
  });
  it("one red answer on a multi choice is red when it is among the chosen ones", () => {
    const r = redRuleFor(cond, ["Lever"]);
    const ctx = (v: unknown) => ({ answers: { conditions: v }, settings: {}, computed: {} });
    expect(evalCondition(r, ctx(toggleOption(["Hart"], "Lever")))).toBe(true);
    expect(evalCondition(r, ctx(["Hart"]))).toBe(false);
  });
  it("single choice: all but one red keeps 'is niet'", () => {
    const men2: Item = { id: "men2", text: "", type: "single_choice", options: ["Bij mijzelf", "Bij familie", "Bij geen van hen"] };
    expect(redRuleFor(men2, ["Bij mijzelf", "Bij familie"])).toEqual({ all: [{ field: "men2", op: "not_eq", value: "Bij geen van hen" }] });
    expect(redRuleFor(men2, [])).toBeUndefined();
  });
  it("a rule on another field is not simple", () => {
    expect(isSimpleRed({ id: "x", text: "", type: "yes_no", red_if: { all: [{ field: "bmi", op: "lt", value: 18 }] } })).toBe(false);
  });
});
