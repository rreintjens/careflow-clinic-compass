import { useState } from "react";

import { PlusIcon, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { evalCondition, isLeaf, resolveValue, type Condition, type Leaf, type QuestionnaireDef } from "@/domain/questionnaire/engine";
import { fromSituations, toSituations, type Row, type RowOp, type Situations } from "@/domain/questionnaire/situations";
import { conditionExample, questionNumbers, type FieldNames } from "@/domain/questionnaire/builder";
import { cn } from "@/lib/utils";

export interface FieldInfo { value: string; label: string; options?: string[] | undefined; kind: "answer" | "computed"; multi?: boolean; number?: number | undefined; unit?: string | undefined; exclusive?: string | undefined }
type Opt = { value: string; label: string };

/** Everything a condition needs: fields, comparison labels, thresholds and the flow for the worked example. */
export interface CondCtx { fields: FieldInfo[]; ops: Opt[]; refs: Opt[]; settings: Record<string, unknown>; computed: Record<string, string>; names?: FieldNames }

export { questionNumbers };

/** Every field a condition can test: answers of all items plus computed fields. */
export function fieldInfos(def: QuestionnaireDef, computed: Record<string, string>, names?: FieldNames): FieldInfo[] {
  const out: FieldInfo[] = [];
  const nums = questionNumbers(def);
  for (const p of def.pages) for (const i of p.items ?? []) {
    if (i.type === "height_weight") {
      out.push({ value: "height_cm", label: "Lengte (cm)", kind: "answer" }, { value: "weight_kg", label: "Gewicht (kg)", kind: "answer" });
    } else if (i.type !== "answer_summary") {
      const options = i.type === "yes_no" ? ["yes", "no"] : i.options ? [...i.options, ...(i.exclusive_option ? [i.exclusive_option] : [])] : undefined;
      out.push({ value: i.id, label: `Vraag ${nums[i.id]} ${short(i.text, 32)}`, options, kind: "answer", multi: i.type === "multi_choice", number: nums[i.id], unit: i.unit, exclusive: i.exclusive_option });
    }
  }
  for (const k of Object.keys(computed)) out.push({ value: k, label: names?.computed[k] || "Berekend veld zonder naam", kind: "computed" });
  return out;
}

const fmtNum = (v: unknown) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toFixed(1)).replace(".", ",") : String(v));
const setting = (v: string, settings: Record<string, unknown>) => v.slice(9).split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), settings);
const answerLabel = (o: string) => (o === "yes" ? "ja" : o === "no" ? "nee" : o === "unknown" ? "weet ik niet" : o.toLowerCase());
const valueText = (v: unknown, settings: Record<string, unknown>, fields: FieldInfo[] = []): string => {
  if (Array.isArray(v)) return v.map((x) => valueText(x, settings, fields)).join(" of ");
  if (typeof v === "string" && v.startsWith("settings.")) return fmtNum(setting(v, settings));
  if (typeof v === "boolean") return v ? "ja" : "nee";
  if (typeof v === "string") return fields.find((f) => f.value === v)?.label ?? answerLabel(v);
  return fmtNum(v);
};
const short = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 2)}…` : s);
const fieldName = (field: string, fields: FieldInfo[]) => fields.find((x) => x.value === field)?.label ?? "Veld zonder naam";

const rowText = (r: Row, fields: FieldInfo[], ops: Record<string, string>, settings: Record<string, unknown>) =>
  `${fieldName(r.field, fields)} ${ops[r.op] ?? r.op} ${valueText(r.value, settings, fields)}${r.op === "between" ? ` en ${valueText(r.value2, settings, fields)}` : ""}`;

/** Plain-language sentence for a condition: situations joined by "of", rows by "en". */
export function conditionText(c: Condition | Leaf | undefined, fields: FieldInfo[], ops: Record<string, string>, settings: Record<string, unknown>): string {
  if (!c) return "";
  const s = toSituations(isLeaf(c) ? { all: [c] } : c);
  const parts = s.map((rows) => rows.map((r) => rowText(r, fields, ops, settings)).join(" en "));
  return parts.length > 1 ? parts.map((p) => `(${p})`).join(" of ") : (parts[0] ?? "");
}

const SHORT_OPS: Record<string, string> = { eq: "=", not_eq: "niet", lt: "onder", lte: "maximaal", gt: "boven", gte: "vanaf", between: "tussen", contains: "bevat" };
/** A threshold value as the design shows it: standard, with the reduced value in brackets when the field switches between two settings. */
function thresholdPair(v: unknown, ctx: CondCtx): { std: string; red?: string } {
  if (typeof v === "number") return { std: fmtNum(v) };
  if (typeof v !== "string") return { std: String(v) };
  if (v.startsWith("settings.")) return { std: fmtNum(setting(v, ctx.settings)) };
  const m = ctx.computed[v]?.match(/^\s*\w+\s*\?\s*(settings\.[\w.]+)\s*:\s*(settings\.[\w.]+)\s*$/);
  if (m) return { std: fmtNum(setting(m[2] as string, ctx.settings)), red: fmtNum(setting(m[1] as string, ctx.settings)) };
  if (v in ctx.computed) return { std: ctx.names?.computed[v] || "berekend veld" };
  return { std: answerLabel(v) };
}
function compactRow(r: Row, ctx: CondCtx): string {
  const f = ctx.fields.find((x) => x.value === r.field);
  const field = f?.number ? `vraag ${f.number}` : f?.label ?? "veld";
  if (f?.options || Array.isArray(r.value) || typeof r.value === "boolean") {
    const vals = (Array.isArray(r.value) ? r.value : [r.value]).map((x) => (typeof x === "boolean" ? (x ? "ja" : "nee") : answerLabel(String(x))));
    return `${field} ${SHORT_OPS[r.op] ?? r.op} ${vals.join(" of ")}`;
  }
  const a = thresholdPair(r.value, ctx);
  if (r.op === "between") {
    const b = thresholdPair(r.value2, ctx);
    const red = a.red || b.red ? ` (${a.red ?? a.std} en ${b.red ?? b.std})` : "";
    return `${field} tussen ${a.std} en ${b.std}${red}`;
  }
  return `${field} ${SHORT_OPS[r.op] ?? r.op} ${a.std}${a.red ? ` (${a.red})` : ""}${f?.unit && /^[\d,]+$/.test(a.std) ? ` ${f.unit}` : ""}`;
}
/** Short line under a builder row, with the numbers filled in: "BMI tussen 25 en 30 (23 en 27,5)". */
export function compactConditionText(c: Condition | Leaf | undefined, ctx: CondCtx): string {
  if (!c) return "";
  const parts = toSituations(isLeaf(c) ? { all: [c] } : c).map((rows) => rows.map((r) => compactRow(r, ctx)).join(" en "));
  return parts.length > 1 ? parts.map((p) => `(${p})`).join(" of ") : (parts[0] ?? "");
}

/** Values a numeric test can compare with: settings thresholds and computed fields. */
export function refOptions(settings: Record<string, unknown>, computed: Record<string, string>, names?: FieldNames) {
  const out: Opt[] = [];
  const walk = (o: unknown, p: string) => {
    if (typeof o === "number") out.push({ value: `settings.${p}`, label: `${fmtNum(o)} (${names?.thresholds[p] || "Grenswaarde zonder naam"})` });
    else if (o && typeof o === "object" && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(settings, "");
  for (const k of Object.keys(computed)) out.push({ value: k, label: names?.computed[k] || "Berekend veld zonder naam" });
  return out;
}

/** "Altijd" or the condition as a sentence, with Wijzig. */
export function ConditionLine({ label, value, empty, onEdit, help, ctx }: { label: string; value: Condition | undefined; empty: string; onEdit: () => void; help?: string; ctx: CondCtx }) {
  const opsMap = Object.fromEntries(ctx.ops.map((o) => [o.value, o.label]));
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex min-h-12 items-center justify-between gap-4 rounded-[14px] bg-sand px-4 py-2 text-[15px]">
        <span className={cn(!value && "text-foreground")}>{value ? conditionText(value, ctx.fields, opsMap, ctx.settings) : empty}</span>
        <TextLink onClick={onEdit}>Wijzig</TextLink>
      </div>
      {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
    </div>
  );
}

const DESIGN_OPS: RowOp[] = ["eq", "not_eq", "gte", "lt", "between", "contains"];
/** A situation describes the meaning, rather than repeating the editor's comparisons. */
export function situationSentence(rows: Row[], ctx: CondCtx): string {
  const example = conditionExample(fromSituations([rows]), ctx.settings, ctx.computed, "2026-10-19", ctx.fields.filter((f) => f.multi).map((f) => f.value));
  const value = (v: unknown) => valueText(resolveValue(v, example.ctx), ctx.settings, ctx.fields);
  const parts = rows.map((r) => {
    const field = ctx.fields.find((f) => f.value === r.field);
    const name = fieldName(r.field, ctx.fields);
    if (typeof r.value === "boolean" && r.op === "eq") return `${r.value ? "Wel" : "Geen"} ${name.toLowerCase()}`;
    if (field?.multi && r.op === "eq" && (Array.isArray(r.value) ? r.value.length === 1 && r.value[0] === field.exclusive : r.value === field.exclusive)) return `bij vraag ${field.number} geen aandoening aangevinkt`;
    if (r.op === "between") return `${name} van ${value(r.value)} tot ${value(r.value2)}${field?.unit ? ` ${field.unit}` : ""}`;
    if (r.op === "eq" && r.value === "unknown") return `${name} is niet bekend`;
    const suffix = field?.unit ? ` ${field.unit}` : "";
    const phrase = r.op === "gte" ? "van minstens" : r.op === "gt" ? "boven" : r.op === "lt" ? "onder" : r.op === "lte" ? "van maximaal" : r.op === "not_eq" ? "is niet" : r.op === "contains" ? "met" : "is";
    return `${name} ${phrase} ${value(r.value)}${suffix}`;
  });
  const body = parts.length > 1 ? `${parts.slice(0, -1).join(", ")}, en ${parts.at(-1)}` : parts[0] ?? "";
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

/** The condition modal: Altijd | Alleen als, situations (of) of rows (en). */
export function ConditionModal({ title, description, alwaysLabel, value, ctx, onSave, onClose, outcome = "show" }: {
  title: string; description: string; alwaysLabel: string; value: Condition | undefined; ctx: CondCtx;
  onSave: (c: Condition | undefined) => void; onClose: () => void; outcome?: "show" | "signal" | "red";
}) {
  const firstField = ctx.fields[0]?.value ?? "";
  const blank = (): Row => ({ field: firstField, op: "eq", value: ctx.fields[0]?.options?.[0] ?? "" });
  const [sits, setSits] = useState<Situations>(() => { const s = toSituations(value); return s.length ? s : [[blank()]]; });
  const [mode, setMode] = useState<"always" | "only">(value ? "only" : "always");
  const setRow = (si: number, ri: number, r: Row) => setSits(sits.map((s, i) => (i === si ? s.map((x, j) => (j === ri ? r : x)) : s)));
  const removeRow = (si: number, ri: number) => setSits(sits.map((s, i) => (i === si ? s.filter((_, j) => j !== ri) : s)).filter((s) => s.length));
  const result = mode === "always" ? undefined : fromSituations(sits);

  const today = new Date().toISOString().slice(0, 10);
  const example = conditionExample(result, ctx.settings, ctx.computed, today, ctx.fields.filter((f) => f.multi).map((f) => f.value));
  const bmi = example.ctx.computed["bmi"];
  const examples: string[] = [];
  if (example.fields.includes("bmi")) examples.push(`${fmtNum(example.answers["height_cm"])} cm en ${fmtNum(Math.round(Number(example.answers["weight_kg"]) * 10) / 10)} kg (BMI ${fmtNum(Math.round(Number(bmi) * 10) / 10)})`);
  for (const f of example.fields.filter((f) => f !== "bmi")) {
    const info = ctx.fields.find((x) => x.value === f);
    const v = example.value(f);
    if (v !== undefined) examples.push(`${fieldName(f, ctx.fields)}: ${valueText(v, ctx.settings, ctx.fields)}${info?.unit ? ` ${info.unit}` : ""}`);
  }
  for (const row of sits[0] ?? []) for (const reference of [row.value, row.value2]) {
    if (typeof reference === "string" && (reference in ctx.computed || reference.startsWith("settings."))) {
      const label = ctx.fields.find((f) => f.value === reference)?.label ?? ctx.refs.find((r) => r.value === reference)?.label ?? "Grenswaarde";
      const text = `${label}: ${valueText(resolveValue(reference, example.ctx), ctx.settings, ctx.fields)}${row.field === "waist_cm" ? " cm" : ""}`;
      if (!examples.includes(text)) examples.push(text);
    }
  }
  const matches = evalCondition(result, example.ctx);
  const outcomeText = outcome === "signal" ? (matches ? "krijgt de arts een signaal" : "krijgt de arts geen signaal") : outcome === "red" ? (matches ? "wordt de uitkomst rood" : "wordt de uitkomst niet rood") : (matches ? "wordt de vraag getoond" : "wordt de vraag niet getoond");
  const summary = `Samengevat: ${sits.length > 1 ? "één van de situaties moet kloppen; binnen een situatie moeten alle voorwaarden kloppen." : "alle voorwaarden moeten kloppen."} Bijvoorbeeld, met ${examples.join(", ")} ${outcomeText}.`;

  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={title} description={description}
      footer={<div className="flex w-full items-center justify-between"><TextLink tone="warning" onClick={() => onSave(undefined)}>Verwijderen</TextLink><div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => onSave(result)}>Opslaan</PillButton></div></div>}>
      <SegmentedControl label="Tonen" value={mode} onChange={setMode} options={[{ value: "always", label: alwaysLabel }, { value: "only", label: "Alleen als" }]} />
      {mode === "only" && (
        <div className="mt-5 flex flex-col">
          {sits.map((s, si) => (
            <div key={si}>
              {si > 0 && <div className="my-3 flex items-center gap-3"><span className="h-px flex-1 bg-line" /><span className="rounded-full bg-teal-light px-3 py-1 text-xs font-medium text-primary">of</span><span className="h-px flex-1 bg-line" /></div>}
              <div className="rounded-[16px] bg-sand p-4">
                <div className="mb-3 text-[13px] font-semibold">Situatie {si + 1}</div>
                <div className="flex flex-col gap-2">
                  {s.map((r, ri) => (
                    <div key={ri} className="flex items-center gap-2">
                      <span className="w-6 shrink-0 text-xs text-muted-foreground">{ri > 0 ? "en" : ""}</span>
                      <RowEditor row={r} ctx={ctx} onChange={(x) => setRow(si, ri, x)} />
                      <button type="button" aria-label="Regel verwijderen" onClick={() => removeRow(si, ri)} className="rounded-full p-1.5 text-muted-foreground hover:bg-background">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pl-8"><TextLink onClick={() => setSits(sits.map((x, i) => (i === si ? [...x, blank()] : x)))}>+ nog een regel (en)</TextLink></div>
                <p className="mt-3 border-t border-line pt-3 text-[13px]">{situationSentence(s, ctx)}</p>
              </div>
            </div>
          ))}
          <div className="mt-4">
            <button type="button" onClick={() => setSits([...sits, [blank()]])} className="inline-flex h-9 items-center gap-2 rounded-full border border-dashed border-primary px-4 text-[13px] text-primary"><PlusIcon />Nog een situatie (of)</button>
          </div>
          <div className="mt-4 flex gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-sm leading-[1.6]">
            <img src="/ui-icons/vinkje.svg" alt="" className="mt-1 size-4 shrink-0" />{summary}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-[1.6] text-muted-foreground">Een regel is: veld, vergelijking, waarde. Velden zijn antwoorden op eerdere vragen en berekende velden zoals BMI en leeftijd. Vergelijkingen: is, is niet, is minimaal, is kleiner dan, ligt tussen, bevat. De getallen komen uit de tabel Grenswaarden; verander je ze daar, dan verandert deze voorwaarde mee.</p>
    </Modal>
  );
}

function RowEditor({ row, ctx, onChange }: { row: Row; ctx: CondCtx; onChange: (r: Row) => void }) {
  const f = ctx.fields.find((x) => x.value === row.field);
  const ops = ctx.ops.filter((o) => DESIGN_OPS.includes(o.value as RowOp) || o.value === row.op);
  const fieldOpts = withCurrent(ctx.fields.map((x) => ({ value: x.value, label: x.label })), row.field);
  const value = (v: unknown, set: (x: unknown) => void, label: string) => {
    if (typeof v === "boolean") return <Select inline label={label} value={v ? "true" : "false"} onChange={(x) => set(x === "true")} options={[{ value: "true", label: "Ja" }, { value: "false", label: "Nee" }]} />;
    if (f?.options) {
      const cur = Array.isArray(v) ? String(v[0] ?? "") : String(v ?? "");
      const opts = f.options.map((o) => ({ value: o, label: answerLabel(o) }));
      return <Select inline label={label} value={cur} onChange={(x) => set(Array.isArray(v) ? [x] : x)} options={withCurrent(opts, cur)} />;
    }
    const numeric = typeof v === "number";
    return (
      <span className="inline-flex items-center gap-2">
        <Select inline label={label} value={numeric ? "__num" : String(v ?? "")} onChange={(x) => set(x === "__num" ? 0 : x)} options={[...withCurrent([...ctx.refs, ...(row.field === "waist_cm" ? [{ value: "unknown", label: "Weet ik niet" }] : [])], numeric ? "" : String(v ?? "")), { value: "__num", label: "Vast getal" }]} />
        {numeric && <input inputMode="decimal" aria-label={`${label}, getal`} className="h-9 w-20 rounded-[10px] bg-background px-3 text-sm outline-none" value={fmtNum(v)} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (!Number.isNaN(n)) set(n); }} />}
      </span>
    );
  };
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <Select inline label="Veld" value={row.field} onChange={(v) => { const nf = ctx.fields.find((x) => x.value === v); onChange({ field: v, op: row.op, value: nf?.options?.[0] ?? "" }); }} options={fieldOpts} />
      <Select inline label="Vergelijking" value={row.op} onChange={(v) => onChange({ ...row, op: v as RowOp, ...(v === "between" ? { value2: row.value2 ?? row.value } : {}) })} options={ops} />
      {value(row.value, (x) => onChange({ ...row, value: x }), "Waarde")}
      {row.op === "between" && <><span className="text-xs text-muted-foreground">en</span>{value(row.value2, (x) => onChange({ ...row, value2: x }), "Tweede waarde")}</>}
    </div>
  );
}
const withCurrent = (o: Opt[], cur: string) => (cur && !o.some((x) => x.value === cur) ? [{ value: cur, label: "Waarde zonder naam" }, ...o] : o);
