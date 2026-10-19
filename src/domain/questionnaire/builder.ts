/** Builder-only visibility targeting and representative inputs; engine rules stay unchanged. */
import { fieldValue, makeCtx, resolveValue, type Answers, type Condition, type Item, type Page } from "./engine";
import { toSituations } from "./situations";

export interface FieldNames { computed: Record<string, string>; thresholds: Record<string, string> }
export const readFieldNames = (document: Record<string, unknown>): FieldNames => {
  const names = (document["field_names"] ?? {}) as Partial<FieldNames>;
  return { computed: names.computed ?? {}, thresholds: names.thresholds ?? {} };
};

export function visibilityTarget(page: Page | undefined): "page" | "item" {
  return page?.items?.length === 1 ? "page" : "item";
}

export function effectiveVisibility(page: Page | undefined, item: Item): Condition | undefined {
  if (page?.show_if && item.show_if) return { all: [page.show_if, item.show_if] };
  return page?.show_if ?? item.show_if;
}

/** Uses source answers, never overrides computed fields. Values are resolved through the same engine. */
export function conditionExample(condition: Condition | undefined, settings: Record<string, unknown>, computed: Record<string, string>, today: string, multiFields: string[] = []) {
  const answers: Answers = { height_cm: 178, weight_kg: 88, date_of_birth: "1988-03-14", sex: "Man", "triage.sex": "Man", origin: ["Geen van deze"] };
  const rows = toSituations(condition)[0] ?? [];
  const ctx = () => makeCtx({ settings, computed_fields: computed }, answers, today);
  for (const row of rows) {
    if (row.field in computed) {
      if ((row.field === "reduced_thresholds" || row.field === "reduced_waist") && row.value === true) {
        const regions = settings[row.field === "reduced_waist" ? "reduced_waist_regions" : "reduced_threshold_regions"];
        if (Array.isArray(regions) && regions[0]) answers["origin"] = [regions[0]];
      }
      continue;
    }
    const v = resolveValue(row.value, ctx());
    if (row.op === "eq" || row.op === "contains") answers[row.field] = multiFields.includes(row.field) && !Array.isArray(v) ? [v] : v;
  }
  for (const row of rows) {
    const v = resolveValue(row.value, ctx());
    if (typeof v !== "number") continue;
    const upper = row.op === "between" ? resolveValue(row.value2, ctx()) : undefined;
    const candidate = row.op === "between" && typeof upper === "number" ? (v + upper) / 2 : row.op === "lt" ? v - 1 : row.op === "gt" ? v + 1 : v;
    if (row.field === "bmi") answers["weight_kg"] = candidate * (Number(answers["height_cm"]) / 100) ** 2;
    else if (!(row.field in computed) && !row.field.startsWith("settings.")) answers[row.field] = candidate;
  }
  return { answers, ctx: ctx(), fields: [...new Set(rows.map((r) => r.field))], value: (field: string) => fieldValue(field, ctx()) };
}
/** Builder numbering: a page without questions counts once, every question counts once. */
export function questionNumbers(def: { pages: Page[] }): Record<string, number> {
  const out: Record<string, number> = {};
  let n = 0;
  for (const p of def.pages) {
    if (!p.items?.length) { n += 1; out[p.id] = n; continue; }
    for (const i of p.items) { n += 1; out[i.id] = n; }
  }
  return out;
}

/** Meaningful one-word name of a question for titles: its longest word (first wins on a tie), lower case. */
export function shortName(text: string): string {
  const words = text.replace(/[?!.,:;“”"()]/g, " ").split(/\s+/).filter(Boolean);
  const best = words.reduce((a, w) => (w.length > a.length ? w : a), "");
  return (best || text).toLowerCase();
}
