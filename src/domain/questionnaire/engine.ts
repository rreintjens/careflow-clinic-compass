/** Questionnaire engine: conditions, computed fields, visible pages, red outcomes and signals. */
import { evaluate } from "./expr";

export type Op = "eq" | "not_eq" | "lt" | "lte" | "gt" | "gte" | "contains";
export interface Leaf { field: string; op: Op; value: unknown }
export type Condition = { all?: Array<Leaf | Condition>; any?: Array<Leaf | Condition> };

export type ItemType =
  | "text" | "number" | "date_segmented" | "yes_no" | "single_choice" | "multi_choice"
  | "height_weight" | "measure_with_image" | "checkbox_required" | "answer_summary";
export type PageType = "text" | "flow_overview" | "question_page" | "boodschap";

export interface Item {
  id: string;
  text: string;
  type: ItemType;
  help?: string;
  options?: string[];
  exclusive_option?: string;
  optional?: boolean;
  unit?: string;
  image?: string;
  allow_unknown?: string;
  fields?: Record<string, { min?: number; max?: number }>;
  show_bmi_after_digits?: number;
  show_if?: Condition;
  red_if?: Condition;
  red_variant?: string;
  signal_if?: Condition | string | string[];
  signal_label?: string;
  prefill_from?: string;
  reuse_in?: string;
  note?: string;
  [k: string]: unknown;
}
export interface Page {
  id: string;
  type?: PageType;
  section?: string;
  title?: string;
  body?: string;
  bullets?: string[];
  button?: string;
  icon?: string;
  image?: string;
  steps?: string;
  show_if?: Condition;
  red_if?: Condition;
  red_variant?: string;
  signal_label?: string;
  show_practitioner_card?: boolean;
  items?: Item[];
  [k: string]: unknown;
}
export interface RejectionVariant { title: string; body: string; advice?: string }
export interface QuestionnaireDef {
  id: string;
  name: string;
  moment: string;
  pages: Page[];
  rejection?: { variants?: Record<string, RejectionVariant>; buttons?: string[]; [k: string]: unknown };
  prefill_from_triage?: string[];
  [k: string]: unknown;
}
export interface FlowFile {
  meta: Record<string, unknown>;
  settings: Record<string, unknown>;
  computed_fields: Record<string, string>;
  questionnaires: QuestionnaireDef[];
  [k: string]: unknown;
}

export type Answers = Record<string, unknown>;
export interface Ctx { answers: Answers; settings: Record<string, unknown>; computed: Record<string, unknown> }

export const isLeaf = (c: Leaf | Condition): c is Leaf => "field" in c;

const path = (obj: unknown, keys: string[]): unknown =>
  keys.reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);

/** Flat field lookup: height_weight stores height_cm / weight_kg as their own fields. */
export function fieldValue(name: string, ctx: Ctx): unknown {
  if (name.startsWith("settings.")) return path(ctx.settings, name.slice(9).split("."));
  if (name in ctx.computed) return ctx.computed[name];
  return ctx.answers[name];
}

/** Literal, settings.* reference, or computed-field reference. */
export function resolveValue(v: unknown, ctx: Ctx): unknown {
  if (typeof v !== "string") return v;
  if (v.startsWith("settings.")) return path(ctx.settings, v.slice(9).split("."));
  if (v in ctx.computed) return ctx.computed[v];
  return v;
}

const sameSet = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((x) => b.includes(x));

function leafTrue(l: Leaf, ctx: Ctx): boolean {
  const a = fieldValue(l.field, ctx);
  const b = resolveValue(l.value, ctx);
  if (a === undefined || a === null || a === "") return false; // unanswered never matches
  const eq = () => (Array.isArray(b) ? Array.isArray(a) && sameSet(a, b) : Array.isArray(a) ? a.length === 1 && a[0] === b : a === b || (typeof a === "number" && Number(b) === a));
  switch (l.op) {
    case "eq": return eq();
    case "not_eq": return !eq();
    case "contains": { const want = Array.isArray(b) ? b : [b]; return Array.isArray(a) ? a.some((x) => want.includes(x)) : want.includes(a); }
    default: {
      const x = typeof a === "number" ? a : Number(a);
      const y = Number(b);
      if (Number.isNaN(x) || Number.isNaN(y)) return false;
      return l.op === "lt" ? x < y : l.op === "lte" ? x <= y : l.op === "gt" ? x > y : x >= y;
    }
  }
}

export function evalCondition(c: Condition | Leaf | undefined, ctx: Ctx): boolean {
  if (!c) return true;
  if (isLeaf(c)) return leafTrue(c, ctx);
  const all = c.all ? c.all.every((x) => evalCondition(x, ctx)) : true;
  const any = c.any ? c.any.some((x) => evalCondition(x, ctx)) : true;
  return all && any;
}

/** Computed fields in file order; each may use earlier ones. Errors give undefined. */
export function computeFields(formulas: Record<string, string>, answers: Answers, settings: Record<string, unknown>, today: string): Record<string, unknown> {
  const computed: Record<string, unknown> = {};
  const ctx: Ctx = { answers, settings, computed };
  for (const [name, f] of Object.entries(formulas)) {
    try {
      const v = evaluate(f, { today, lookup: (n) => fieldValue(n, ctx) });
      computed[name] = typeof v === "number" && !Number.isFinite(v) ? undefined : v;
    } catch {
      computed[name] = undefined;
    }
  }
  return computed;
}

export const makeCtx = (flow: Pick<FlowFile, "settings" | "computed_fields">, answers: Answers, today: string): Ctx => ({
  answers,
  settings: flow.settings,
  computed: computeFields(flow.computed_fields, answers, flow.settings, today),
});

export const pageType = (p: Page): PageType => p.type ?? (p.items && p.items.length > 1 ? "question_page" : "question_page");
export const isQuestionPage = (p: Page) => !!p.items?.length;

export const visiblePages = (q: QuestionnaireDef, ctx: Ctx) => q.pages.filter((p) => evalCondition(p.show_if, ctx));
export const visibleItems = (p: Page, ctx: Ctx) => (p.items ?? []).filter((i) => evalCondition(i.show_if, ctx));

/** Fields an item writes (height_weight writes two). */
export const itemFields = (i: Item) => (i.type === "height_weight" ? Object.keys(i.fields ?? { height_cm: {}, weight_kg: {} }) : i.type === "answer_summary" ? [] : [i.id]);

export function itemAnswered(i: Item, answers: Answers): boolean {
  if (i.type === "answer_summary") return true;
  if (i.type === "checkbox_required") return answers[i.id] === true;
  return itemFields(i).every((f) => {
    const v = answers[f];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== "";
  });
}

/** A page may continue when every visible, non-optional item is answered. */
export const pageComplete = (p: Page, ctx: Ctx) => visibleItems(p, ctx).every((i) => i.optional || itemAnswered(i, ctx.answers));

/** "k van m vragen beantwoord" for one page. */
export function pageProgress(p: Page, ctx: Ctx) {
  const items = visibleItems(p, ctx).filter((i) => i.type !== "answer_summary");
  return { answered: items.filter((i) => itemAnswered(i, ctx.answers)).length, total: items.length };
}

/** The resume screen: progress per visible question page and where to continue. */
export interface ResumePage { id: string; title: string; answered: number; total: number; complete: boolean }
export function resumeState(q: QuestionnaireDef, flow: Pick<FlowFile, "settings" | "computed_fields">, answers: Answers, today: string) {
  const ctx = makeCtx(flow, answers, today);
  const pages = visiblePages(q, ctx).filter(isQuestionPage).map((p) => {
    const progress = pageProgress(p, ctx);
    return { id: p.id, title: p.title ?? p.items?.[0]?.text ?? p.id, ...progress, complete: pageComplete(p, ctx) };
  });
  const next = pages.find((p) => !p.complete) ?? null;
  return { pages, nextPageId: next?.id ?? pages.at(-1)?.id ?? null, pageNumber: next ? pages.indexOf(next) + 1 : pages.length, pageCount: pages.length };
}

/** Which rejection variant a red rule shows when none is set explicitly. */
export function defaultRedVariant(source: { field?: string | undefined; section?: string | undefined }, variants: string[]): string {
  const want = source.field === "age" ? "age" : source.field === "bmi" ? "bmi_low" : source.section === "Veiligheidscheck" ? "medical" : "weight_route";
  return variants.includes(want) ? want : (variants[0] ?? want);
}

const firstField = (c: Condition | undefined): string | undefined => {
  for (const x of [...(c?.all ?? []), ...(c?.any ?? [])]) {
    if (isLeaf(x)) return x.field;
    const f = firstField(x);
    if (f) return f;
  }
  return undefined;
};

export interface RedOutcome { variant: string; reason: string } // reason = item or page id, counted anonymously

/** First red rule that fires on this page (item rules, then the page rule). */
export function redOnPage(q: QuestionnaireDef, p: Page, ctx: Ctx): RedOutcome | null {
  const variants = Object.keys(q.rejection?.variants ?? {});
  for (const i of visibleItems(p, ctx)) {
    if (i.red_if && itemAnswered(i, ctx.answers) && evalCondition(i.red_if, ctx))
      return { variant: i.red_variant ?? defaultRedVariant({ field: firstField(i.red_if), section: p.section }, variants), reason: i.id };
  }
  if (p.red_if && pageComplete(p, ctx) && evalCondition(p.red_if, ctx))
    return { variant: p.red_variant ?? defaultRedVariant({ field: firstField(p.red_if), section: p.section }, variants), reason: p.id };
  return null;
}

export interface Signal { item: string; label: string }

function signalFires(i: Item, ctx: Ctx): boolean {
  const s = i.signal_if;
  const v = ctx.answers[i.id];
  if (s === undefined || !itemAnswered(i, ctx.answers)) return false;
  if (s === "any_except_exclusive") return Array.isArray(v) && v.some((x) => x !== i.exclusive_option);
  if (typeof s === "string") return v === s;
  if (Array.isArray(s)) return Array.isArray(v) ? v.some((x) => s.includes(x as string)) : s.includes(v as string);
  return evalCondition(s, ctx);
}

/** Signals raised by the visible answers; never blocking. */
export function collectSignals(q: QuestionnaireDef, ctx: Ctx): Signal[] {
  const out: Signal[] = [];
  for (const p of visiblePages(q, ctx)) {
    for (const i of visibleItems(p, ctx)) if (signalFires(i, ctx)) out.push({ item: i.id, label: i.signal_label ?? i.text });
    if (p.signal_label && p.red_if && pageComplete(p, ctx) && !evalCondition(p.red_if, ctx)) out.push({ item: p.id, label: p.signal_label });
  }
  return out;
}

/** Choosing an option of a multi-choice item; the exclusive option clears the others and vice versa. */
export function toggleOption(current: unknown, option: string, exclusive?: string): string[] {
  const cur = Array.isArray(current) ? (current as string[]) : [];
  if (cur.includes(option)) return cur.filter((x) => x !== option);
  if (option === exclusive) return [option];
  return [...cur.filter((x) => x !== exclusive), option];
}

/** Steps of a flow_overview page: fixed start, sections of visible pages, fixed end. */
export function flowSteps(q: QuestionnaireDef, ctx: Ctx, currentPageId: string, before: string[], after: string[]) {
  const pages = visiblePages(q, ctx);
  const idx = pages.findIndex((p) => p.id === currentPageId);
  const sections: string[] = [];
  for (const p of pages) if (p.section && !sections.includes(p.section)) sections.push(p.section);
  const done = new Set(pages.slice(0, idx).map((p) => p.section).filter(Boolean));
  const next = pages.slice(idx + 1).find((p) => p.section)?.section;
  return [
    ...before.map((label) => ({ label, state: "done" as const })),
    ...sections.map((label) => ({ label, state: label === next && !done.has(label) ? ("current" as const) : done.has(label) && label !== next ? ("done" as const) : ("todo" as const) })),
    ...after.map((label) => ({ label, state: "todo" as const })),
  ];
}

/** Applies prefill_from ("triage.<field>") and the questionnaire's prefill list. */
export function prefillAnswers(q: QuestionnaireDef, triage: Answers): Answers {
  const out: Answers = {};
  for (const f of q.prefill_from_triage ?? []) {
    if (f === "height_weight") { out["height_cm"] = triage["height_cm"]; out["weight_kg"] = triage["weight_kg"]; }
    else if (triage[f] !== undefined) out[f] = triage[f];
  }
  for (const p of q.pages) for (const i of p.items ?? []) {
    if (i.prefill_from?.startsWith("triage.")) {
      const v = triage[i.prefill_from.slice(7)];
      if (v !== undefined && out[i.id] === undefined) out[i.id] = i.type === "yes_no" && typeof v === "string" ? (v === "Nee" ? "no" : "yes") : v;
    }
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
}

/** Number of questions (items that take an answer). */
export const questionCount = (q: QuestionnaireDef) => q.pages.reduce((n, p) => n + (p.items ?? []).filter((i) => i.type !== "answer_summary").length, 0);
