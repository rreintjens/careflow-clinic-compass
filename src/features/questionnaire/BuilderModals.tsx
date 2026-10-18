import { useState } from "react";

import { Checkbox, TextArea, TextField, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import type { Condition, Item, ItemType, Page, PageType } from "@/domain/questionnaire/engine";
import { evaluate } from "@/domain/questionnaire/expr";
import { cn } from "@/lib/utils";

import { ConditionEditor, type FieldInfo } from "./conditions";

type Opt = { value: string; label: string };
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "vraag";

/** Optional condition block: off = no condition. */
function OptionalCondition({ label, value, onChange, ctx }: { label: string; value?: Condition | undefined; onChange: (c: Condition | undefined) => void; ctx: CondCtx }) {
  return (
    <div className="flex flex-col gap-2">
      <Checkbox label={label} checked={!!value} onChange={(on) => onChange(on ? { all: [] } : undefined)} />
      {value && <ConditionEditor value={value} onChange={onChange} {...ctx} />}
    </div>
  );
}
export interface CondCtx { fields: FieldInfo[]; ops: Opt[]; refs: Opt[] }

export function PageModal({ page, pageTypes, sections, icons, ctx, onSave, onDelete, onClose }: {
  page: Page | null; pageTypes: Opt[]; sections: string[]; icons: string[]; ctx: CondCtx;
  onSave: (p: Page) => void; onDelete?: (() => void) | undefined; onClose: () => void;
}) {
  const [p, setP] = useState<Page>(page ?? { id: `p_${Date.now().toString(36)}`, type: "text", title: "" });
  const [iconOpen, setIconOpen] = useState(false);
  const type = (p.type ?? "question_page") as PageType;
  const set = (patch: Record<string, unknown>) => setP({ ...p, ...patch } as Page);
  const clean = (x: Page): Page => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0 && v !== x.items))) as Page;
  return (
    <>
      <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={page ? "Pagina wijzigen" : "Pagina toevoegen"} description="Wat de patiënt op dit scherm ziet."
        footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Pagina verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => onSave(clean(p))}>Opslaan</PillButton></div></div>}>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Soort pagina" value={type} onChange={(v) => set({ type: v as PageType, items: v === "question_page" ? (p.items ?? []) : p.items })} options={pageTypes} />
          <Select label="Onderdeel" value={p.section ?? "__none"} onChange={(v) => set({ section: v === "__none" ? undefined : v })} options={[{ value: "__none", label: "Geen" }, ...sections.map((s) => ({ value: s, label: s }))]} help="Nieuw onderdeel? Typ het bij een vraag." />
          <TextField label="Titel" value={p.title ?? ""} onChange={(e) => set({ title: e.target.value })} className="col-span-2" />
          <TextArea label="Tekst" value={p.body ?? ""} onChange={(e) => set({ body: e.target.value })} className="col-span-2" help="Gebruik {voornaam}, {behandelaar_voornaam}, {dag}, {tijd} voor gegevens van de afspraak." />
          {(type === "text" || type === "boodschap") && <TextArea label="Opsomming (één per regel)" value={(p.bullets ?? []).join("\n")} onChange={(e) => set({ bullets: lines(e.target.value) })} className="col-span-2" />}
          <TextField label="Tekst op de knop" value={p.button ?? ""} onChange={(e) => set({ button: e.target.value })} help="Leeg = Verder." />
          {(type === "text" || type === "boodschap") && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Icoon</span>
              <button type="button" onClick={() => setIconOpen(true)} className="flex h-12 items-center gap-3 rounded-[14px] bg-sand px-4 text-left text-[15px]">
                {p.icon ? <><img src={`/ui-icons/${p.icon}.svg`} alt="" className="size-5" />{p.icon}</> : <span className="text-muted-foreground">Geen icoon</span>}
              </button>
            </div>
          )}
        </div>
        <div className="mt-5"><OptionalCondition label="Alleen tonen onder een voorwaarde" value={p.show_if} onChange={(c) => set({ show_if: c })} ctx={ctx} /></div>
        {type === "question_page" && <div className="mt-4"><OptionalCondition label="Rood als (voor de hele pagina)" value={p.red_if} onChange={(c) => set({ red_if: c })} ctx={ctx} /></div>}
      </Modal>
      {iconOpen && <IconPicker icons={icons} value={p.icon} onPick={(i) => { set({ icon: i }); setIconOpen(false); }} onClose={() => setIconOpen(false)} />}
    </>
  );
}

export function IconPicker({ icons, value, onPick, onClose }: { icons: string[]; value?: string | undefined; onPick: (i: string | undefined) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const shown = icons.filter((i) => i.includes(q.toLowerCase()));
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Icoon kiezen" description="Alleen iconen uit de vaste set."
      footer={<><TextLink onClick={() => onPick(undefined)}>Geen icoon</TextLink><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton></>}>
      <TextField label="Zoeken" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 grid grid-cols-6 gap-2">
        {shown.map((i) => (
          <button key={i} type="button" title={i} onClick={() => onPick(i)} className={cn("flex flex-col items-center gap-1 rounded-[12px] p-2 text-[11px]", value === i ? "bg-teal-light ring-1 ring-primary" : "bg-sand")}>
            <img src={`/ui-icons/${i}.svg`} alt="" className="size-6" /><span className="w-full truncate">{i}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}

export function ItemModal({ item, itemTypes, sections, section, rejections, ctx, onSave, onDelete, onClose }: {
  item: Item | null; itemTypes: Opt[]; sections: string[]; section?: string | undefined; rejections: Opt[]; ctx: CondCtx;
  onSave: (i: Item, section: string | undefined) => void; onDelete?: (() => void) | undefined; onClose: () => void;
}) {
  const [i, setI] = useState<Item>(item ?? { id: "", text: "", type: "single_choice", options: [] });
  const [sec, setSec] = useState(section ?? "");
  const set = (patch: Record<string, unknown>) => setI({ ...i, ...patch } as Item);
  const t = i.type;
  const hasOptions = t === "single_choice" || t === "multi_choice";
  const sigMode = i.signal_if === undefined ? "none" : typeof i.signal_if === "string" && i.signal_if !== "any_except_exclusive" ? "value" : i.signal_if === "any_except_exclusive" ? "any" : Array.isArray(i.signal_if) ? "values" : "condition";
  const choices = t === "yes_no" ? ["yes", "no"] : [...(i.options ?? []), ...(i.exclusive_option ? [i.exclusive_option] : [])];
  const save = () => {
    const id = i.id || slug(i.text);
    const out = Object.fromEntries(Object.entries({ ...i, id }).filter(([, v]) => v !== undefined && v !== "")) as Item;
    onSave(out, sec.trim() || undefined);
  };
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={item ? "Vraag wijzigen" : "Vraag toevoegen"} description="De vraag, de antwoorden en de beslisregel."
      footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Vraag verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!i.text.trim()} onClick={save}>Opslaan</PillButton></div></div>}>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Type vraag" value={t} onChange={(v) => set({ type: v as ItemType })} options={itemTypes} />
        <div className="flex flex-col gap-2">
          <Select label="Onderdeel" value={sections.includes(sec) ? sec : sec ? "__new" : "__none"} onChange={(v) => setSec(v === "__none" ? "" : v === "__new" ? " " : v)} options={[{ value: "__none", label: "Geen" }, ...sections.map((s) => ({ value: s, label: s })), { value: "__new", label: "Nieuw onderdeel" }]} />
          {sec && !sections.includes(sec) && <TextField label="Naam onderdeel" value={sec.trim()} onChange={(e) => setSec(e.target.value || " ")} />}
        </div>
        <TextField label="Vraag" value={i.text} onChange={(e) => set({ text: e.target.value })} className="col-span-2" />
        <TextArea label="Toelichting onder de vraag" value={i.help ?? ""} onChange={(e) => set({ help: e.target.value })} className="col-span-2" />
        {hasOptions && <TextArea label="Antwoorden (één per regel)" value={(i.options ?? []).join("\n")} onChange={(e) => set({ options: lines(e.target.value) })} className="col-span-2" />}
        {t === "multi_choice" && <TextField label="Antwoord dat de rest uitsluit" value={i.exclusive_option ?? ""} onChange={(e) => set({ exclusive_option: e.target.value })} help="Bijvoorbeeld: Geen van deze." />}
        {(t === "number" || t === "measure_with_image") && <TextField label="Eenheid" value={i.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} />}
        {t === "measure_with_image" && <TextField label="Antwoord als de patiënt het niet weet" value={i.allow_unknown ?? ""} onChange={(e) => set({ allow_unknown: e.target.value })} />}
        <div className="col-span-2"><Checkbox label="Optioneel (mag leeg blijven)" checked={!!i.optional} onChange={(v) => set({ optional: v || undefined })} /></div>
        {t === "answer_summary" && <div className="col-span-2"><Checkbox label="Toon de opsomming van alle antwoorden" checked={i.show_list !== false} onChange={(v) => set({ show_list: v ? undefined : false })} help="Uit: de patiënt ziet alleen deze vraag en de knop." /></div>}
      </div>
      <div className="mt-5 flex flex-col gap-4">
        <OptionalCondition label="Alleen tonen onder een voorwaarde (verschijnt onder de vorige vraag)" value={i.show_if} onChange={(c) => set({ show_if: c })} ctx={ctx} />
        <OptionalCondition label="Rood als" value={i.red_if} onChange={(c) => set({ red_if: c })} ctx={ctx} />
        {i.red_if && <Select label="Afwijzingsscherm" value={i.red_variant ?? "__auto"} onChange={(v) => set({ red_variant: v === "__auto" ? undefined : v })} options={[{ value: "__auto", label: "Automatisch kiezen" }, ...rejections]} />}
        <div className="grid grid-cols-2 gap-4">
          <Select label="Signaal voor de arts" value={sigMode} onChange={(m) => set({ signal_if: m === "none" ? undefined : m === "any" ? "any_except_exclusive" : m === "value" ? (choices[0] ?? "yes") : m === "values" ? [] : { all: [] } })}
            options={[{ value: "none", label: "Geen signaal" }, ...(t === "multi_choice" ? [{ value: "any", label: "Bij elk antwoord behalve het uitsluitende" }] : []), ...(t === "yes_no" ? [{ value: "value", label: "Bij één antwoord" }] : []), ...(hasOptions ? [{ value: "values", label: "Bij gekozen antwoorden" }] : []), { value: "condition", label: "Onder een voorwaarde" }]} />
          {i.signal_if !== undefined && <TextField label="Naam van het signaal" value={i.signal_label ?? ""} onChange={(e) => set({ signal_label: e.target.value })} />}
          {sigMode === "value" && <Select label="Antwoord" value={String(i.signal_if)} onChange={(v) => set({ signal_if: v })} options={choices.map((c) => ({ value: c, label: c === "yes" ? "Ja" : c === "no" ? "Nee" : c }))} />}
        </div>
        {sigMode === "values" && (
          <div className="flex flex-col gap-2">{choices.map((c) => <Checkbox key={c} label={c} checked={(i.signal_if as string[]).includes(c)} onChange={(on) => set({ signal_if: on ? [...(i.signal_if as string[]), c] : (i.signal_if as string[]).filter((x) => x !== c) })} />)}</div>
        )}
        {sigMode === "condition" && <ConditionEditor value={i.signal_if as Condition} onChange={(c) => set({ signal_if: c })} {...ctx} />}
      </div>
    </Modal>
  );
}

/** Thresholds: numeric settings, standard and reduced side by side. */
export function ThresholdsModal({ settings, rows, onSave, onClose }: { settings: Record<string, unknown>; rows: Array<{ label: string; std: string; red: string }>; onSave: (s: Record<string, unknown>) => void; onClose: () => void }) {
  const [s, setS] = useState<Record<string, unknown>>(JSON.parse(JSON.stringify(settings)));
  const get = (p: string) => p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], s);
  const put = (p: string, v: number) => {
    const next = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    const keys = p.split(".");
    let o = next;
    for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
    o[keys.at(-1) as string] = v;
    setS(next);
  };
  const num = (p: string) => (
    <input inputMode="decimal" aria-label={p} className="h-11 w-full rounded-[12px] bg-sand px-3 text-[15px] outline-none" defaultValue={String(get(p) ?? "").replace(".", ",")} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (!Number.isNaN(n)) put(p, n); }} />
  );
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Grenswaarden wijzigen" description="Gelden direct voor nieuwe antwoorden."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => onSave(s)}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-[1fr_140px_140px] items-center gap-3 text-sm">
        <span className="text-xs text-muted-foreground">Regel</span><span className="text-xs text-muted-foreground">Standaard</span><span className="text-xs text-muted-foreground">Verlaagd</span>
        {rows.map((r) => <div key={r.label} className="contents"><span>{r.label}</span>{num(r.std)}{num(r.red)}</div>)}
      </div>
    </Modal>
  );
}

export function ComputedModal({ name, formula, sample, onSave, onDelete, onClose }: { name: string | null; formula: string; sample: (f: string) => string; onSave: (n: string, f: string) => void; onDelete?: (() => void) | undefined; onClose: () => void }) {
  const [n, setN] = useState(name ?? "");
  const [f, setF] = useState(formula);
  let check = "";
  try { evaluate(f, { today: "2026-01-01", lookup: () => 1 }); check = sample(f); } catch (e) { check = e instanceof Error ? e.message : "Formule klopt niet"; }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={name ? "Berekend veld wijzigen" : "Berekend veld toevoegen"} description="Velden tussen accolades, bijvoorbeeld {weight_kg}."
      footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!n.trim() || !f.trim()} onClick={() => onSave(slug(n), f)}>Opslaan</PillButton></div></div>}>
      <div className="flex flex-col gap-4">
        <TextField label="Veld" value={n} onChange={(e) => setN(e.target.value)} disabled={!!name} />
        <TextField label="Formule" value={f} onChange={(e) => setF(e.target.value)} className="font-mono" />
        <p className="text-[13px] text-muted-foreground">Voorbeeld: {check}</p>
      </div>
    </Modal>
  );
}

export function PublishModal({ versionNo, changes, onPublish, onClose, busy }: { versionNo: number; changes: string; onPublish: () => void; onClose: () => void; busy: boolean }) {
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Versie ${versionNo} publiceren`} description="Nieuwe patiënten krijgen deze versie. Eerder ingevulde antwoorden blijven bij hun eigen versie."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={busy} onClick={onPublish}>Publiceren</PillButton></>}>
      <p className="text-sm leading-[1.6]">{changes}</p>
      <p className="mt-3 text-sm leading-[1.6]">De huidige actieve versie gaat naar het archief.</p>
    </Modal>
  );
}
