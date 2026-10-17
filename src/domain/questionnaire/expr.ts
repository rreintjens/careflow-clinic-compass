/**
 * Tiny formula language for computed fields, e.g.
 *   {weight_kg} / ({height_cm}/100)^2
 *   years_since({date_of_birth})
 *   any_in({origin}, settings.reduced_threshold_regions)
 *   reduced ? settings.bmi.a : settings.bmi.b
 *   (sex=='Vrouw' ? 1 : 2)
 * `{x}` and bare identifiers resolve through `lookup`; dotted names (settings.a.b) too.
 */
export type Value = unknown;
export interface ExprEnv {
  lookup: (name: string) => Value;
  today: string; // YYYY-MM-DD
}

type Tok = { t: "num"; v: number } | { t: "str"; v: string } | { t: "id"; v: string } | { t: "op"; v: string };

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i] as string;
    if (/\s/.test(c)) { i++; continue; }
    if (/[0-9.]/.test(c)) {
      let j = i; while (j < src.length && /[0-9.]/.test(src[j] as string)) j++;
      out.push({ t: "num", v: Number(src.slice(i, j)) }); i = j; continue;
    }
    if (c === "'" || c === '"') {
      const j = src.indexOf(c, i + 1);
      out.push({ t: "str", v: src.slice(i + 1, j) }); i = j + 1; continue;
    }
    if (c === "{") {
      const j = src.indexOf("}", i);
      out.push({ t: "id", v: src.slice(i + 1, j).trim() }); i = j + 1; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i; while (j < src.length && /[A-Za-z0-9_.]/.test(src[j] as string)) j++;
      out.push({ t: "id", v: src.slice(i, j) }); i = j; continue;
    }
    const two = src.slice(i, i + 2);
    if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) { out.push({ t: "op", v: two }); i += 2; continue; }
    if ("+-*/^()?:,<>×".includes(c)) { out.push({ t: "op", v: c === "×" ? "*" : c }); i++; continue; }
    throw new Error(`Unexpected '${c}' in formula`);
  }
  return out;
}

const FUNCS: Record<string, (env: ExprEnv, args: Value[]) => Value> = {
  years_since: (env, [d]) => yearsBetween(typeof d === "string" ? d : "", env.today),
  any_in: (_e, [a, list]) => {
    const xs = Array.isArray(a) ? a : a == null ? [] : [a];
    return Array.isArray(list) && xs.some((x) => list.includes(x));
  },
};

/** Whole years from `from` to `to` (YYYY-MM-DD); NaN when `from` is invalid. */
export function yearsBetween(from: string, to: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(from);
  const n = /^(\d{4})-(\d{2})-(\d{2})$/.exec(to);
  if (!m || !n) return Number.NaN;
  let y = Number(n[1]) - Number(m[1]);
  if (Number(n[2]) * 100 + Number(n[3]) < Number(m[2]) * 100 + Number(m[3])) y--;
  return y;
}

export function evaluate(src: string, env: ExprEnv): Value {
  const toks = tokenize(src);
  let p = 0;
  const peek = () => toks[p];
  const isOp = (v: string) => { const t = peek(); return t?.t === "op" && t.v === v; };
  const eat = (v: string) => { if (!isOp(v)) throw new Error(`Expected '${v}'`); p++; };
  const num = (x: Value) => (typeof x === "number" ? x : x == null || x === "" ? Number.NaN : Number(x));

  function ternary(): Value {
    const c = or();
    if (isOp("?")) { p++; const a = ternary(); eat(":"); const b = ternary(); return c ? a : b; }
    return c;
  }
  function or(): Value { let l = and(); while (isOp("||")) { p++; const r = and(); l = Boolean(l) || Boolean(r); } return l; }
  function and(): Value { let l = cmp(); while (isOp("&&")) { p++; const r = cmp(); l = Boolean(l) && Boolean(r); } return l; }
  function cmp(): Value {
    const l = add();
    for (const op of ["==", "!=", ">=", "<=", ">", "<"]) {
      if (isOp(op)) {
        p++; const r = add();
        if (op === "==") return l === r;
        if (op === "!=") return l !== r;
        const a = num(l), b = num(r);
        return op === ">=" ? a >= b : op === "<=" ? a <= b : op === ">" ? a > b : a < b;
      }
    }
    return l;
  }
  function add(): Value {
    let l = mul();
    while (isOp("+") || isOp("-")) { const o = (peek() as Tok).v; p++; const r = mul(); l = o === "+" ? num(l) + num(r) : num(l) - num(r); }
    return l;
  }
  function mul(): Value {
    let l = pow();
    while (isOp("*") || isOp("/")) { const o = (peek() as Tok).v; p++; const r = pow(); l = o === "*" ? num(l) * num(r) : num(l) / num(r); }
    return l;
  }
  function pow(): Value { const b = unary(); if (isOp("^")) { p++; return num(b) ** num(pow()); } return b; }
  function unary(): Value { if (isOp("-")) { p++; return -num(unary()); } return atom(); }
  function atom(): Value {
    const t = peek();
    if (!t) throw new Error("Unexpected end of formula");
    p++;
    if (t.t === "num" || t.t === "str") return t.v;
    if (t.t === "op" && t.v === "(") { const v = ternary(); eat(")"); return v; }
    if (t.t === "id") {
      if (isOp("(") && FUNCS[t.v]) {
        p++; const args: Value[] = [];
        if (!isOp(")")) { args.push(ternary()); while (isOp(",")) { p++; args.push(ternary()); } }
        eat(")");
        return (FUNCS[t.v] as (e: ExprEnv, a: Value[]) => Value)(env, args);
      }
      return env.lookup(t.v);
    }
    throw new Error(`Unexpected '${t.v}'`);
  }
  const v = ternary();
  if (p !== toks.length) throw new Error("Unexpected text after formula");
  return v;
}

/** Field names a formula reads ({x} and bare identifiers, without settings.*). */
export function formulaFields(src: string): string[] {
  try {
    return [...new Set(tokenize(src).filter((t) => t.t === "id" && !t.v.startsWith("settings.") && !FUNCS[t.v]).map((t) => String(t.v)))];
  } catch {
    return [];
  }
}
