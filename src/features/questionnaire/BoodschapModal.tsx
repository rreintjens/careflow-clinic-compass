import { useState } from "react";

import { PlusIcon, TextArea, TextField, TextLink, inputCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import type { Condition, Page, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { cn } from "@/lib/utils";

import { MessageFields } from "./MessageFields";
import { ConditionModal, compactConditionText, type CondCtx } from "./conditions";
import { QuestionnaireRunner, type UiTexts } from "./QuestionnaireRunner";

type Opt = { value: string; label: string };

/** Editable list of points with drag handles, "+ Punt" and remove; replaces the one-per-line text box. */
export function PointsEditor({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  const [drag, setDrag] = useState<number | null>(null);
  const move = (from: number, to: number) => { const n = [...value]; const [m] = n.splice(from, 1); if (m !== undefined) n.splice(to, 0, m); onChange(n); };
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      {value.map((v, i) => (
        <div key={i} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== i) move(drag, i); setDrag(null); }}
          className="flex min-h-11 items-center gap-3 rounded-[12px] bg-sand px-4 py-2">
          <span className="cursor-grab text-xs text-muted-foreground" aria-hidden="true">⋮⋮</span>
          <textarea rows={1} aria-label={`Punt ${i + 1}`} className="min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-[1.4] outline-none [field-sizing:content]" value={v} onChange={(e) => onChange(value.map((x, j) => (j === i ? e.target.value : x)))} />
          <button type="button" aria-label="Punt verwijderen" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded-full p-1 text-muted-foreground hover:bg-background">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      ))}
      <div><button type="button" onClick={() => onChange([...value, ""])} className="inline-flex h-9 items-center gap-2 rounded-full border border-dashed border-primary px-4 text-[13px] text-primary"><PlusIcon />Punt</button></div>
    </div>
  );
}

export type FlowPosition = { value: string; label: string };
export const START = "__start";

/** "Waar in de flow" choices: at the start, or after any other row of the builder. */
export function flowPositions(def: QuestionnaireDef, nums: Record<string, number>, exclude?: string): FlowPosition[] {
  const cut = (s: string) => (s.length > 28 ? `${s.slice(0, 26)}…` : s);
  return [{ value: START, label: "Aan het begin" }, ...def.pages.filter((p) => p.id !== exclude).map((p) => {
    const items = p.items ?? [];
    if (!items.length) return { value: p.id, label: `Na pagina ${nums[p.id]} (${cut(p.title ?? "")})` };
    if (items.length === 1 && !p.title && items[0]) return { value: p.id, label: `Na vraag ${nums[items[0].id]} (${cut(items[0].text)})` };
    return { value: p.id, label: `Na vragenpagina (${cut(p.title ?? p.section ?? "")})` };
  })];
}

/** Boodschap window: form, place in the flow, visibility, title, form fields, image and button, with a live preview. */
export function BoodschapModal({ page, after, positions, forms, images, buttons, ctx, questionnaireName, def, flow, ui, practitioner, onSave, onDelete, onClose }: {
  page: Page | null; after: string; positions: FlowPosition[]; forms: Opt[]; images: Opt[]; buttons: Opt[]; ctx: CondCtx; questionnaireName: string;
  def: QuestionnaireDef; flow: { settings: Record<string, unknown>; computed_fields: Record<string, string> }; ui: UiTexts;
  practitioner: { name: string; text: string; photo?: string | undefined };
  onSave: (p: Page, after: string) => void; onDelete?: (() => void) | undefined; onClose: () => void;
}) {
  const [p, setP] = useState<Page>(page ?? { id: `p_${Date.now().toString(36)}`, type: "boodschap", form: "list", title: "", bullets: [""] });
  const [where, setWhere] = useState(after);
  const [cond, setCond] = useState(false);
  const set = (patch: Record<string, unknown>) => setP((x) => ({ ...x, ...patch } as Page));
  const form = (p["form"] as string | undefined) ?? "list";
  const steps = (p["step_items"] as string[] | undefined) ?? ["", "", ""];
  const clean = (x: Page): Page => {
    const keep: Record<string, string[]> = { list: ["bullets"], steps: ["step_items"], testimonial: ["quote", "quote_name", "quote_place"], practitioner: ["show_practitioner_card"] };
    const all = ["bullets", "step_items", "quote", "quote_name", "quote_place", "show_practitioner_card"];
    const out: Record<string, unknown> = { ...x, type: "boodschap", form, ...(form === "practitioner" ? { show_practitioner_card: true } : {}) };
    for (const k of all) if (!(keep[form] ?? []).includes(k)) delete out[k];
    if (Array.isArray(out["bullets"])) out["bullets"] = (out["bullets"] as string[]).filter((b) => b.trim());
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined && v !== "")) as Page;
  };
  const preview: QuestionnaireDef = { ...def, pages: [{ ...clean(p), id: "preview" }] };
  const vars = { behandelaar_naam: practitioner.name, behandelaar_voornaam: practitioner.name.split(" ")[0] ?? "", behandelaar_tekst: practitioner.text, ...(practitioner.photo ? { behandelaar_foto: practitioner.photo } : {}) };
  const showText = p.show_if ? compactConditionText(p.show_if, ctx) : "";
  return (
    <>
      <Modal open width="xl" onOpenChange={(o) => !o && onClose()} title={page ? "Boodschap wijzigen" : "Boodschap toevoegen"} description={questionnaireName}
        footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!(p.title ?? "").trim()} onClick={() => onSave(clean(p), where)}>Opslaan</PillButton></div></div>}>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Vorm</span>
          <SegmentedControl variant="chips" label="Vorm" value={form} onChange={(v) => set({ form: v, ...(v === "steps" && !p["step_items"] ? { step_items: ["", "", ""] } : {}) })} options={forms} />
          <p className="text-xs leading-[1.6] text-muted-foreground">Opsomming: titel, punten, afbeelding. Stappen: drie genummerde stappen, bijvoorbeeld “Zo werkt het”. Ervaring: een quote van een patiënt met voornaam en locatie. Je behandelaar: foto en korte tekst van de arts bij wie de patiënt de afspraak heeft.</p>
        </div>
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] gap-6">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Waar in de flow" value={where} onChange={setWhere} options={positions} />
              <div className="flex flex-col gap-2">
                <Select label="Tonen" value={p.show_if ? "only" : "always"} onChange={(v) => { if (v === "always") set({ show_if: undefined }); else setCond(true); }} options={[{ value: "always", label: "Altijd" }, { value: "only", label: p.show_if ? `Alleen als ${showText}` : "Alleen als …" }]}
                  help="Of alleen onder een voorwaarde, bijvoorbeeld als de BMI boven de 30 is." />
                {p.show_if && <TextLink onClick={() => setCond(true)}>Voorwaarde wijzigen</TextLink>}
              </div>
            </div>
            <MessageFields page={p} onChange={setP} maxPoints={4}/>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Afbeelding" value={p.image ?? "__none"} onChange={(v) => set({ image: v === "__none" ? undefined : v })} options={[{ value: "__none", label: "Geen" }, ...images]} help="Uit de beeldbank van de site." />
              <Select label="Knop" value={p.button ?? buttons[0]?.value ?? ""} onChange={(v) => set({ button: v })} options={withCurrent(buttons, p.button)} />
            </div>
          </div>
          <aside className="flex min-w-0 flex-col gap-2">
            <span className="text-[13px] font-medium">Voorbeeld</span>
            <div className={cn("h-[560px] w-[312px] overflow-hidden rounded-[18px]")}>
              <div className="origin-top-left scale-[0.8]">
                <QuestionnaireRunner key={JSON.stringify(preview.pages[0])} flow={flow} def={preview} ui={ui} today={new Date().toISOString().slice(0, 10)} vars={vars} />
              </div>
            </div>
          </aside>
        </div>
      </Modal>
      {cond && <ConditionModal title={`Wanneer tonen we de boodschap ${p.title ? `“${p.title}”` : ""}?`.replace(" ?", "?")} description={questionnaireName} alwaysLabel="Altijd tonen" value={p.show_if} ctx={ctx} outcome="show" onClose={() => setCond(false)} onSave={(c: Condition | undefined) => { set({ show_if: c }); setCond(false); }} />}
    </>
  );
}
const withCurrent = (o: Opt[], cur: string | undefined) => (cur && !o.some((x) => x.value === cur) ? [{ value: cur, label: cur }, ...o] : o);
