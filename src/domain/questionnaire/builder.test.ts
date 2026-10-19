import { describe, expect, it } from "vitest";
import seed from "@/seed/tbc_flow_medisch_afvallen_v0.2.json";
import { conditionExample, effectiveVisibility, readFieldNames, visibilityTarget } from "./builder";
import { evalCondition, type FlowFile, type Item, type Page } from "./engine";

const flow = seed as unknown as FlowFile;
function find(id: string): { page: Page; item: Item } {
  for (const p of flow.questionnaires[0]?.pages ?? []) for (const i of p.items ?? []) if (i.id === id) return { page: p, item: i };
  throw new Error(`Missing seed item ${id}`);
}
describe("builder visibility", () => {
  it.each(["comorbidities", "waist_cm"])("%s edits its single-question page condition", (id) => {
    const { page, item } = find(id);
    expect(visibilityTarget(page)).toBe("page");
    expect(effectiveVisibility(page, item)).toEqual(page.show_if);
    expect(page.show_if).toBeDefined();
  });
  it("question 9 stays item-targeted inside its grouped page with inherited visibility", () => {
    const { page, item } = find("burden");
    expect(visibilityTarget(page)).toBe("item");
    expect(effectiveVisibility(page, item)).toEqual(page.show_if);
    expect(page.show_if).toBeDefined();
  });
  it("grouped questions edit their own rule and retain the page rule", () => {
    const { item } = find("waist_cm");
    const pageRule = { all: [{ field: "bmi", op: "gte" as const, value: 25 }] };
    const itemRule = { all: [{ field: "waist_cm", op: "gte" as const, value: 102 }] };
    const page = { id: "group", items: [item, { ...item, id: "other" }], show_if: pageRule };
    expect(visibilityTarget(page)).toBe("item");
    expect(effectiveVisibility(page, { ...item, show_if: itemRule })).toEqual({ all: [pageRule, itemRule] });
  });
});
describe("condition-specific source examples", () => {
  it.each(["comorbidities", "waist_cm", "burden"])("%s supplies source answers that show the question", (id) => {
    const { page } = find(id);
    const ex = conditionExample(page.show_if, flow.settings, flow.computed_fields, "2026-10-19", ["comorbidities"]);
    expect(evalCondition(page.show_if, ex.ctx)).toBe(true);
    expect(Number(ex.ctx.computed["bmi"])).toBeGreaterThanOrEqual(25);
    expect(Number(ex.ctx.computed["bmi"])).toBeLessThan(30);
    if (id === "burden") expect(ex.answers["waist_cm"]).toBe(101);
  });
  it("waist signal compares cm against the resolved male threshold", () => {
    const { item } = find("waist_cm");
    if (!item.signal_if || typeof item.signal_if === "string" || Array.isArray(item.signal_if)) throw new Error("Expected condition");
    const ex = conditionExample(item.signal_if, flow.settings, flow.computed_fields, "2026-10-19");
    expect(ex.answers["waist_cm"]).toBe(102);
    expect(ex.ctx.computed["waist_min"]).toBe(102);
    expect(evalCondition(item.signal_if, ex.ctx)).toBe(true);
  });
  it("names remain separate from formula identifiers", () => {
    const names = { computed: { bmi: "BMI" }, thresholds: { "bmi.red_below": "BMI-ondergrens" } };
    expect(readFieldNames(JSON.parse(JSON.stringify({ ...flow, field_names: names })))).toEqual(names);
  });
});