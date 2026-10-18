import { describe, expect, it } from "vitest";

import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";

import { collectSignals, makeCtx, pageComplete, prefillAnswers, redOnPage, resumeState, toggleOption, visiblePages, type Answers, type FlowFile } from "./engine";
import { evaluate, yearsBetween } from "./expr";
import { joinFlow, sameJson, splitFlow } from "./io";

const flow = seed as unknown as FlowFile;
const triage = flow.questionnaires.find((q) => q.id === "triage")!;
const medical = flow.questionnaires.find((q) => q.id === "medical")!;
const TODAY = "2026-10-18";

/** Walks the triage like a patient; returns the first red variant, or "green". */
function runTriage(a: Answers): string {
  const ctx = makeCtx(flow, a, TODAY);
  for (const p of visiblePages(triage, ctx)) {
    const red = redOnPage(triage, p, ctx);
    if (red) return red.variant;
  }
  return "green";
}
const ok: Answers = {
  date_of_birth: "1980-05-01", sex: "Vrouw", origin: ["Geen van deze"], height_cm: 170, weight_kg: 95,
  conditions: ["Geen van deze"], men2: "Bij geen van hen", mental: "Geen van deze",
};
const bmi = (b: number, h = 170) => Math.round(b * (h / 100) ** 2 * 10) / 10;

describe("formulas", () => {
  it.each([
    ["{weight_kg} / ({height_cm}/100)^2", { weight_kg: 88, height_cm: 178 }, 27.77],
    ["{gewicht} × 0,85".replace("0,85", "0.85"), { gewicht: 88 }, 74.8],
  ])("%s", (f, vars, expected) => {
    expect(evaluate(f, { today: TODAY, lookup: (n) => (vars as Record<string, unknown>)[n] }) as number).toBeCloseTo(expected, 1);
  });
  it.each([["1988-03-14", "2026-10-18", 38], ["2008-10-19", "2026-10-18", 17], ["2008-10-18", "2026-10-18", 18]])("age %s on %s = %d", (dob, today, y) => {
    expect(yearsBetween(dob, today)).toBe(y);
  });
  it("reduced thresholds from origin", () => {
    const c = makeCtx(flow, { origin: ["Oost- of Zuidoost-Aziatisch"], sex: "Vrouw" }, TODAY).computed;
    expect([c["bmi_waist_from"], c["bmi_direct_from"], c["waist_min"]]).toEqual([23, 27.5, 80]);
    const d = makeCtx(flow, { origin: ["Afrikaans of Afrikaans-Caribisch"], sex: "Man" }, TODAY).computed;
    expect([d["bmi_waist_from"], d["bmi_direct_from"], d["waist_min"]]).toEqual([23, 27.5, 102]);
  });
});

describe("triage routing (red outcomes)", () => {
  it.each<[string, Answers, string]>([
    ["all fine, BMI >= 30 skips weight questions", ok, "green"],
    ["age 17", { ...ok, date_of_birth: "2009-10-19" }, "age"],
    ["age 86", { ...ok, date_of_birth: "1940-01-01" }, "age"],
    ["BMI below 18", { ...ok, weight_kg: bmi(17.5) }, "bmi_low"],
    ["middle BMI, comorbidity", { ...ok, weight_kg: bmi(27), comorbidities: ["Hoge bloeddruk"] }, "green"],
    ["middle BMI, enlarged waist", { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: 95 }, "green"],
    ["middle BMI, no waist, burden yes", { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: 80, burden: "Ja, ik ervaar veel last" }, "green"],
    ["middle BMI, nothing", { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: 80, burden: "Nee" }, "weight_route"],
    ["middle BMI, waist unknown, no burden", { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: "unknown", burden: "Nee" }, "weight_route"],
    ["reduced: BMI 28 counts as direct", { ...ok, origin: ["Zuid-Azië of Hindoestaanse afkomst"], weight_kg: bmi(28) }, "green"],
    ["low BMI, history", { ...ok, weight_kg: bmi(22), higher_weight_past: "yes", weightloss_meds_now: "Nee" }, "green"],
    ["low BMI, nothing", { ...ok, weight_kg: bmi(22), higher_weight_past: "no", weightloss_meds_now: "Nee" }, "weight_route"],
    ["hard condition", { ...ok, conditions: ["Ernstig nierfalen"] }, "medical"],
    ["MEN 2", { ...ok, men2: "Bij een ouder" }, "medical"],
    ["mental", { ...ok, mental: "Een verslaving" }, "medical"],
  ])("%s -> %s", (_n, a, expected) => expect(runTriage(a)).toBe(expected));

  it("weight pages hidden at BMI >= 30", () => {
    const ids = visiblePages(triage, makeCtx(flow, ok, TODAY)).map((p) => p.id);
    expect(ids).not.toContain("p_comorb");
    expect(ids).not.toContain("p_low_bmi");
  });
  it("unanswered page is not complete", () => {
    const ctx = makeCtx(flow, {}, TODAY);
    expect(pageComplete(triage.pages.find((p) => p.id === "p_safety")!, ctx)).toBe(false);
  });
});

describe("exclusive option", () => {
  it.each<[string[], string, string[]]>([
    [["A"], "Geen van deze", ["Geen van deze"]],
    [["Geen van deze"], "A", ["A"]],
    [["A"], "B", ["A", "B"]],
    [["A", "B"], "A", ["B"]],
  ])("%j + %s -> %j", (cur, opt, exp) => expect(toggleOption(cur, opt, "Geen van deze")).toEqual(exp));
});

describe("signals", () => {
  it.each<[string, Answers, string[]]>([
    ["lithium", { lithium: "yes" }, ["lithium"]],
    ["pancreatitis", { pancreatitis: "yes" }, ["pancreatitis"]],
    ["GLP-1 allergy unknown", { glp1_allergy: "Weet ik niet" }, ["glp1_allergy"]],
    ["familial thyroid cancer", { family: ["Overgewicht", "Familiaire schildklierkanker"] }, ["family"]],
    ["nothing", { lithium: "no", pancreatitis: "no", glp1_allergy: "Nee", family: ["Geen van deze"] }, []],
  ])("medical: %s", (_n, a, items) => {
    const s = collectSignals(medical, makeCtx(flow, a, TODAY)).map((x) => x.item).filter((x) => ["lithium", "pancreatitis", "glp1_allergy", "family"].includes(x));
    expect(s).toEqual(items);
  });
  it("triage: enlarged waist and burden", () => {
    const a = { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: 95 };
    expect(collectSignals(triage, makeCtx(flow, a, TODAY)).map((s) => s.label)).toContain("vergrote buikomvang");
    const b = { ...ok, weight_kg: bmi(27), comorbidities: ["Geen van deze"], waist_cm: 80, burden: "Ja, ik ervaar veel last" };
    expect(collectSignals(triage, makeCtx(flow, b, TODAY)).map((s) => s.label)).toContain("lijdensdruk");
  });
  it("triage: low BMI route raises its signal", () => {
    const a = { ...ok, weight_kg: bmi(22), higher_weight_past: "yes", weightloss_meds_now: "Nee" };
    expect(collectSignals(triage, makeCtx(flow, a, TODAY)).map((s) => s.label)).toContain("laag BMI, historie of medicatie");
  });
});

describe("prefill and import/export", () => {
  it("medical prefills from triage", () => {
    const p = prefillAnswers(medical, { ...ok, weight_kg: 95, weightloss_meds_now: "Nee" });
    expect(p["sex"]).toBe("Vrouw");
    expect(p["height_cm"]).toBe(170);
    expect(p["conditions"]).toEqual(["Geen van deze"]);
  });
  it("export equals import", () => {
    const { document, questionnaires } = splitFlow(JSON.parse(JSON.stringify(flow)));
    expect(sameJson(joinFlow(document, questionnaires), flow)).toBe(true);
    expect(JSON.stringify(joinFlow(document, questionnaires))).toBe(JSON.stringify(flow));
  });
});

describe("answer summary list", () => {
  it("shows the list unless the editor turns it off", () => {
    const base = { id: "review", text: "Klopt alles?", type: "answer_summary" as const };
    expect(showsAnswerList(base)).toBe(true);
    expect(showsAnswerList({ ...base, show_list: true })).toBe(true);
    expect(showsAnswerList({ ...base, show_list: false })).toBe(false);
    expect(showsAnswerList({ id: "sex", text: "Geslacht?", type: "yes_no" })).toBe(true);
  });
});

describe("resume screen", () => {
  it("lists every visible question page with its counts and the first incomplete page", () => {
    const s = resumeState(medical, flow, {}, TODAY);
    expect(s.pageCount).toBeGreaterThan(1);
    expect(s.pageNumber).toBe(1);
    expect(s.nextPageId).toBe(s.pages[0]!.id);
    expect(s.pages.every((p) => p.answered === 0 && !p.complete)).toBe(true);
  });
  it("continues at the first incomplete page and keeps earlier answers", () => {
    const first = resumeState(medical, flow, {}, TODAY).pages[0]!;
    const ctx = makeCtx(flow, {}, TODAY);
    const items = medical.pages.find((p) => p.id === first.id)!.items ?? [];
    const answers: Answers = {};
    for (const i of items) answers[i.type === "height_weight" ? "height_cm" : i.id] = "x";
    const s = resumeState(medical, flow, answers, TODAY);
    expect(s.pages[0]!.complete).toBe(true);
    expect(s.pageNumber).toBe(2);
    expect(s.nextPageId).toBe(s.pages[1]!.id);
    expect(ctx).toBeTruthy();
  });
  it("points at the last page when everything is answered but not yet sent", () => {
    const ctxAnswers: Answers = {};
    const ctx = makeCtx(flow, ctxAnswers, TODAY);
    for (const p of visiblePages(medical, ctx)) for (const i of p.items ?? []) {
      if (i.optional || i.type === "answer_summary") continue;
      if (i.type === "height_weight") { ctxAnswers["height_cm"] = 170; ctxAnswers["weight_kg"] = 80; }
      else if (i.type === "checkbox_required") ctxAnswers[i.id] = true;
      else ctxAnswers[i.id] = "x";
    }
    const s = resumeState(medical, flow, ctxAnswers, TODAY);
    expect(s.pages.every((p) => p.complete)).toBe(true);
    expect(s.nextPageId).toBe(s.pages.at(-1)!.id);
    expect(s.pageNumber).toBe(s.pageCount);
  });
});
