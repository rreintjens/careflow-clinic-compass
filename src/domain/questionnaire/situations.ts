/** Maps engine conditions to the builder's "situations" (any of all-of rows) and back, plus per-answer red outcomes. */
import { evalCondition, isLeaf, type Condition, type Ctx, type Item, type Leaf, type Op } from "./engine";

/** A row in the condition modal; "between" is UI-only and becomes gte + lt. */
export type RowOp = Op | "between";
export interface Row { field: string; op: RowOp; value: unknown; value2?: unknown }
export type Situations = Row[][];

/** Disjunctive normal form: list of situations, each a list of leaves that must all hold. */
function dnf(c: Condition | Leaf): Leaf[][] {
  if (isLeaf(c)) return [[c]];
  let out: Leaf[][] = [[]];
  for (const x of c.all ?? []) {
    const d = dnf(x);
    out = out.flatMap((a) => d.map((b) => [...a, ...b]));
  }
  if (c.any) {
    const d = c.any.flatMap((x) => dnf(x));
    out = out.flatMap((a) => d.map((b) => [...a, ...b]));
  }
  return out;
}

/** gte X directly followed by lt Y on the same field reads as one "ligt tussen" row. */
function toRows(leaves: Leaf[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < leaves.length; i++) {
    const l = leaves[i] as Leaf, n = leaves[i + 1];
    if (l.op === "gte" && n && n.op === "lt" && n.field === l.field) { rows.push({ field: l.field, op: "between", value: l.value, value2: n.value }); i++; }
    else rows.push({ field: l.field, op: l.op, value: l.value });
  }
  return rows;
}

export function toSituations(c: Condition | undefined): Situations {
  if (!c) return [];
  return dnf(c).map(toRows).filter((s) => s.length > 0);
}

const toLeaves = (s: Row[]): Leaf[] => s.flatMap((r) => (r.op === "between" ? [{ field: r.field, op: "gte" as Op, value: r.value }, { field: r.field, op: "lt" as Op, value: r.value2 }] : [{ field: r.field, op: r.op, value: r.value }]));

/** One situation = { all }; several = { any: [{ all }] }; several single-row situations = { any: [leaves] }. */
export function fromSituations(s: Situations): Condition | undefined {
  const sits = s.filter((x) => x.length > 0).map(toLeaves);
  if (!sits.length) return undefined;
  if (sits.length === 1) return { all: sits[0] as Leaf[] };
  if (sits.every((x) => x.length === 1)) return { any: sits.map((x) => x[0] as Leaf) };
  return { any: sits.map((x) => ({ all: x })) };
}

/** All answers of a choice question, the exclusive one last. */
export const answerValues = (i: Item): string[] => (i.type === "yes_no" ? ["yes", "no"] : [...(i.options ?? []), ...(i.exclusive_option ? [i.exclusive_option] : [])]);

const leaves = (c: Condition | Leaf): Leaf[] => (isLeaf(c) ? [c] : [...(c.all ?? []), ...(c.any ?? [])].flatMap(leaves));

/** The red rule only tests this question's own answer with is / is niet / bevat, so it can be shown per answer. */
export function isSimpleRed(i: Item): boolean {
  if (!i.red_if) return true;
  const c = i.red_if;
  const flat = [...(c.all ?? []), ...(c.any ?? [])];
  if ((c.all?.length ?? 0) > 1 || (c.all && c.any)) return false;
  return flat.length > 0 && flat.every((x) => isLeaf(x) && x.field === i.id && (x.op === "eq" || x.op === "not_eq" || x.op === "contains")) && leaves(c).length === flat.length;
}

/** Which answers make the question red (each tested alone). */
export function redAnswers(i: Item): string[] {
  if (!i.red_if) return [];
  const multi = i.type === "multi_choice";
  return answerValues(i).filter((o) => evalCondition(i.red_if, { answers: { [i.id]: multi ? [o] : o }, settings: {}, computed: {} } as Ctx));
}

/** Red rule for a set of red answers: "red when one of the red answers is chosen". */
export function redRuleFor(i: Item, red: string[]): Condition | undefined {
  if (!red.length) return undefined;
  const all = answerValues(i);
  const green = all.filter((o) => !red.includes(o));
  if (i.type === "multi_choice") {
    // Everything except the exclusive answer is red: keep the original "is niet [exclusive]" form.
    if (i.exclusive_option && green.length === 1 && green[0] === i.exclusive_option) return { all: [{ field: i.id, op: "not_eq", value: [i.exclusive_option] }] };
    return red.length === 1 ? { all: [{ field: i.id, op: "contains", value: red[0] }] } : { any: red.map((r) => ({ field: i.id, op: "contains" as Op, value: r })) };
  }
  if (green.length === 1 && red.length > 1) return { all: [{ field: i.id, op: "not_eq", value: green[0] }] };
  return red.length === 1 ? { all: [{ field: i.id, op: "eq", value: red[0] }] } : { any: red.map((r) => ({ field: i.id, op: "eq" as Op, value: r })) };
}
