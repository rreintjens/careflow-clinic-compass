import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { TextLink, inputCls } from "@/components/Field";
import { isLeaf, type Condition, type Leaf, type Op, type QuestionnaireDef } from "@/domain/questionnaire/engine";

export interface FieldInfo { value: string; label: string; options?: string[]; kind: "answer" | "computed" }

/** Every field a condition can test: answers of all items plus computed fields. */
export function fieldInfos(def: QuestionnaireDef, computed: Record<string, string>): FieldInfo[] {
  const out: FieldInfo[] = [];
  for (const p of def.pages) for (const i of p.items ?? []) {
    if (i.type === "height_weight") {
      out.push({ value: "height_cm", label: "Lengte (cm)", kind: "answer" }, { value: "weight_kg", label: "Gewicht (kg)", kind: "answer" });
    } else if (i.type !== "answer_summary") {
      const options = i.type === "yes_no" ? ["yes", "no"] : i.options ? [...i.options, ...(i.exclusive_option ? [i.exclusive_option] : [])] : i.allow_unknown ? ["unknown"] : undefined;
      out.push({ value: i.id, label: i.text, options, kind: "answer" });
    }
  }
  for (const k of Object.keys(computed)) out.push({ value: k, label: `${k} (berekend)`, kind: "computed" });
  return out;
}

const fmtNum = (v: unknown) => (typeof v === "number" ? String(v).replace(".", ",") : String(v));
const valueText = (v: unknown, settings: Record<string, unknown>): string => {
  if (Array.isArray(v)) return v.join(" of ");
  if (typeof v === "string" && v.startsWith("settings.")) {
    const r = v.slice(9).split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), settings);
    return fmtNum(r);
  }
  if (v === "yes") return "ja";
  if (v === "no") return "nee";
  if (v === "unknown") return "weet ik niet";
  return fmtNum(v);
};

/** One readable line for a condition, e.g. "bmi groter dan of gelijk aan bmi_waist_from en …". */
export function conditionText(c: Condition | Leaf | undefined, fields: FieldInfo[], ops: Record<string, string>, settings: Record<string, unknown>): string {
  if (!c) return "";
  if (isLeaf(c)) {
    const f = fields.find((x) => x.value === c.field);
    const name = f ? (f.kind === "computed" ? c.field : short(f.label)) : c.field;
    return `${name} ${ops[c.op] ?? c.op} ${valueText(c.value, settings)}`;
  }
  const parts = [...(c.all ?? []).map((x) => conditionText(x, fields, ops, settings))];
  const any = (c.any ?? []).map((x) => conditionText(x, fields, ops, settings));
  const all = parts.join(" en ");
  const anyT = any.length ? `(${any.join(" of ")})` : "";
  return [all, anyT].filter(Boolean).join(" en ");
}
const short = (s: string) => (s.length > 40 ? `${s.slice(0, 38)}…` : s);

/** Editor for an all/any group; rows are tests or nested groups. */
export function ConditionEditor({ value, onChange, fields, ops, refs }: {
  value: Condition; onChange: (c: Condition) => void; fields: FieldInfo[]; ops: Array<{ value: string; label: string }>; refs: Array<{ value: string; label: string }>;
}) {
  const mode: "all" | "any" = value.any && !value.all ? "any" : "all";
  const rows = (value[mode] ?? []) as Array<Leaf | Condition>;
  const setRows = (r: Array<Leaf | Condition>) => onChange({ [mode]: r });
  const update = (i: number, row: Leaf | Condition) => setRows(rows.map((x, j) => (j === i ? row : x)));
  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-line p-3">
      <SegmentedControl label="Geldt als" value={mode} onChange={(m) => onChange({ [m]: rows })} options={[{ value: "all", label: "Alle regels" }, { value: "any", label: "Eén van de regels" }]} />
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {isLeaf(r) ? <LeafRow leaf={r} onChange={(l) => update(i, l)} fields={fields} ops={ops} refs={refs} /> : <ConditionEditor value={r} onChange={(c) => update(i, c)} fields={fields} ops={ops} refs={refs} />}
          </div>
          <span className="pt-9"><TextLink tone="warning" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Weg</TextLink></span>
        </div>
      ))}
      <div className="flex gap-4">
        <TextLink onClick={() => setRows([...rows, { field: fields[0]?.value ?? "", op: "eq", value: "" }])}>Regel toevoegen</TextLink>
        <TextLink onClick={() => setRows([...rows, { any: [] }])}>Groep toevoegen</TextLink>
      </div>
    </div>
  );
}

function LeafRow({ leaf, onChange, fields, ops, refs }: { leaf: Leaf; onChange: (l: Leaf) => void; fields: FieldInfo[]; ops: Array<{ value: string; label: string }>; refs: Array<{ value: string; label: string }> }) {
  const f = fields.find((x) => x.value === leaf.field);
  const isMulti = Array.isArray(leaf.value);
  const current = isMulti ? String((leaf.value as unknown[])[0] ?? "") : String(leaf.value ?? "");
  const fieldSel = <Select label="Veld" value={leaf.field} onChange={(v) => onChange({ ...leaf, field: v, value: "" })} options={withCurrent(fields.map((x) => ({ value: x.value, label: short(x.label) })), leaf.field)} />;
  const opSel = <Select label="Toets" value={leaf.op} onChange={(v) => onChange({ ...leaf, op: v as Op })} options={ops} />;
  if (f?.options) {
    const options = f.options.map((o) => ({ value: o, label: o === "yes" ? "Ja" : o === "no" ? "Nee" : o === "unknown" ? "Weet ik niet" : o }));
    return <div className="grid grid-cols-3 gap-2">{fieldSel}{opSel}<Select label="Waarde" value={current} onChange={(v) => onChange({ ...leaf, value: isMulti ? [v] : v })} options={withCurrent(options, current)} /></div>;
  }
  const numeric = typeof leaf.value === "number";
  return (
    <div className="grid grid-cols-3 gap-2">
      {fieldSel}{opSel}
      <div className="flex flex-col gap-2">
        <Select label="Waarde" value={numeric ? "__num" : current} onChange={(v) => onChange({ ...leaf, value: v === "__num" ? 0 : v })} options={[...withCurrent(refs, numeric ? "" : current), { value: "__num", label: "Vast getal" }]} />
        {numeric && <input inputMode="decimal" aria-label="Getal" className={inputCls} value={String(leaf.value).replace(".", ",")} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (!Number.isNaN(n)) onChange({ ...leaf, value: n }); }} />}
      </div>
    </div>
  );
}
const withCurrent = (o: Array<{ value: string; label: string }>, cur: string) => (cur && !o.some((x) => x.value === cur) ? [{ value: cur, label: cur }, ...o] : o);

/** Values a numeric test can compare with: settings thresholds and computed fields. */
export function refOptions(settings: Record<string, unknown>, computed: Record<string, string>) {
  const out: Array<{ value: string; label: string }> = [];
  const walk = (o: unknown, p: string) => {
    if (typeof o === "number") out.push({ value: `settings.${p}`, label: `${p} (${fmtNum(o)})` });
    else if (o && typeof o === "object" && !Array.isArray(o)) for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
  };
  walk(settings, "");
  for (const k of Object.keys(computed)) out.push({ value: k, label: `${k} (berekend)` });
  return out;
}
