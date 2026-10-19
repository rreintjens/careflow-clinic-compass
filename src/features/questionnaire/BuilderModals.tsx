import { useRef, useState, type ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import { Checkbox, PlusIcon, TextArea, TextField, TextLink, inputCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import type { Condition, Item, ItemType, Page, PageType, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { effectiveVisibility, shortName, visibilityTarget } from "@/domain/questionnaire/builder";
import { answerValues, isSimpleRed, redAnswers, redRuleFor } from "@/domain/questionnaire/situations";
import { evaluate } from "@/domain/questionnaire/expr";
import { UiIcon } from "@/components/UiIcon";
import { cn } from "@/lib/utils";

import { PointsEditor } from "./BoodschapModal";
import { ConditionLine, ConditionModal, type CondCtx } from "./conditions";
import { QuestionnaireRunner, type Lang, type UiTexts } from "./QuestionnaireRunner";

type Opt = { value: string; label: string };
export type { CondCtx };
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "vraag";

type CondTarget = { key: string; title: string; always: string; value: Condition | undefined; set: (c: Condition | undefined) => void };

export function PageModal({ page, initialType, pageTypes, sections, icons, iconCategories, ctx, questionnaireName, onSave, onDelete, onClose }: {
  page: Page | null; initialType?: PageType | undefined; pageTypes: Opt[]; sections: string[]; icons: IconEntry[]; iconCategories: Opt[]; ctx: CondCtx; questionnaireName: string;
  onSave: (p: Page) => void; onDelete?: (() => void) | undefined; onClose: () => void;
}) {
  const [p, setP] = useState<Page>(page ?? { id: `p_${Date.now().toString(36)}`, type: initialType ?? "text", title: "", ...(initialType === "question_page" ? { items: [] } : {}) });
  const [iconOpen, setIconOpen] = useState(false);
  const [cond, setCond] = useState<CondTarget | null>(null);
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
          {type === "text" && <div className="col-span-2"><PointsEditor label="Opsomming" value={p.bullets ?? []} onChange={(b) => set({ bullets: b })} /></div>}
          <TextField label="Tekst op de knop" value={p.button ?? ""} onChange={(e) => set({ button: e.target.value })} help="Leeg = Verder." />
          {(type === "text" || type === "boodschap") && (
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-medium">Icoon</span>
              <button type="button" onClick={() => setIconOpen(true)} className="flex h-12 items-center gap-3 rounded-[14px] bg-sand px-4 text-left text-[15px]">
                {p.icon ? <><UiIcon name={p.icon} className="size-5 text-primary" />{p.icon}</> : <span className="text-muted-foreground">Geen icoon</span>}
              </button>
            </div>
          )}
        </div>
        <div className="mt-5"><ConditionLine label="Tonen" empty="Altijd" value={p.show_if} ctx={ctx} onEdit={() => setCond({ key: "show", title: `Wanneer tonen we de pagina ${p.title ? `“${p.title}”` : p.section || ""}?`.replace(" ?", "?"), always: "Altijd tonen", value: p.show_if, set: (c) => set({ show_if: c }) })} /></div>
        {type === "question_page" && <div className="mt-4"><ConditionLine label="Rood als (voor de hele pagina)" empty="Nooit" value={p.red_if} ctx={ctx} onEdit={() => setCond({ key: "red", title: "Wanneer is deze pagina rood?", always: "Nooit rood", value: p.red_if, set: (c) => set({ red_if: c }) })} /></div>}
      </Modal>
      {cond && <ConditionModal title={cond.title} description={questionnaireName} alwaysLabel={cond.always} value={cond.value} ctx={ctx} outcome={cond.key === "signal" ? "signal" : cond.key === "red" ? "red" : "show"} onClose={() => setCond(null)} onSave={(c) => { cond.set(c); setCond(null); }} />}
      {iconOpen && <IconPicker icons={icons} categories={iconCategories} pageTitle={p.title ?? ""} value={p.icon} onPick={(i) => { set({ icon: i }); setIconOpen(false); }} onClose={() => setIconOpen(false)} />}
    </>
  );
}

export type IconEntry = { name: string; tags: string[] };

/** Icon picker of vragenlijst-icoon.dc.html: search on name or meaning, category pills, results and all icons. */
export function IconPicker({ icons, categories, pageTitle, value, onPick, onClose }: { icons: IconEntry[]; categories: Opt[]; pageTitle: string; value?: string | undefined; onPick: (i: string | undefined) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string | undefined>(value);
  const [all, setAll] = useState(false);
  const catNames = [...new Set(categories.map((c) => c.label))];
  const catOf = (n: string) => categories.find((c) => c.value === n)?.label;
  const needle = q.trim().toLowerCase();
  const results = needle ? icons.filter((i) => i.name.includes(needle) || i.tags.some((t) => t.includes(needle))) : cat ? icons.filter((i) => catOf(i.name) === cat) : [];
  const shown = all ? icons : icons.slice(0, 40);
  const tile = (i: IconEntry) => (
    <button key={i.name} type="button" onClick={() => setChosen(i.name)} aria-pressed={chosen === i.name}
      className={cn("flex flex-col items-center gap-1.5 rounded-[12px] border-[1.5px] px-1.5 py-3 text-[11px] font-medium", chosen === i.name ? "border-primary bg-teal-light" : "border-line bg-background")}>
      <UiIcon name={i.name} className="size-[26px] text-primary" /><span className="w-full truncate">{i.name}</span>
    </button>
  );
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} width="lg" title="Kies een icoon" description={`${pageTitle ? `Voor de pagina “${pageTitle}” · ` : ""}zoek op naam of betekenis`}
      footer={<div className="flex w-full items-center justify-between"><TextLink onClick={() => onPick(undefined)}>Geen icoon</TextLink><div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!chosen} onClick={() => onPick(chosen)}>Gebruik dit icoon</PillButton></div></div>}>
      <div className="flex flex-col gap-4">
        <label className="flex h-[46px] items-center gap-2 rounded-full bg-sand px-4">
          <UiIcon name="zoeken" className="size-[18px] text-muted-foreground" />
          <input aria-label="Zoek een icoon" autoFocus className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={q} onChange={(e) => { setQ(e.target.value); setCat(null); }} />
          {(needle || cat) && <span className="text-xs text-muted-foreground">{results.length} van {icons.length}</span>}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {catNames.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => { setCat(cat === c ? null : c); setQ(""); }} className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium", cat === c ? "bg-primary text-primary-foreground" : "bg-sand")}>{c}</button>)}
        </div>
        {(needle || cat) && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Resultaten voor “{needle || cat}”</span>
            {results.length ? <div className="grid grid-cols-4 gap-2">{results.map(tile)}</div> : <p className="text-sm text-muted-foreground">Geen icoon gevonden.</p>}
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium">Alle iconen</span>
          <div className="flex flex-wrap gap-1.5">
            {shown.map((i) => (
              <button key={i.name} type="button" title={i.name} aria-label={i.name} aria-pressed={chosen === i.name} onClick={() => setChosen(i.name)}
                className={cn("flex size-11 items-center justify-center rounded-[10px] border", chosen === i.name ? "border-primary bg-teal-light text-primary" : "border-line bg-background text-foreground")}>
                <UiIcon name={i.name} className="size-5" />
              </button>
            ))}
            {!all && icons.length > 40 && <button type="button" onClick={() => setAll(true)} className="flex size-11 items-center justify-center rounded-[10px] bg-sand text-[11px] text-muted-foreground">+{icons.length - 40}</button>}
          </div>
        </div>
        {chosen && (
          <div className="flex items-center gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-[13px] leading-[1.5]">
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-background text-primary"><UiIcon name={chosen} className="size-5" /></span>
            <span>Gekozen: <strong className="font-semibold">{chosen}</strong>. Grootte en kleur volgen de pagina.</span>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function ItemModal({ item, initialType, number, questionnaireName, questionnaireId, def, page, flow, ui, itemTypes, sections, section, rejections, images, ctx, onSave, onDelete, onClose }: {
  item: Item | null; initialType?: ItemType | undefined; number: number; questionnaireName: string; questionnaireId: string; def: QuestionnaireDef; page: Page | undefined;
  flow: { settings: Record<string, unknown>; computed_fields: Record<string, string> }; ui: UiTexts;
  itemTypes: Opt[]; sections: string[]; section?: string | undefined; rejections: Opt[]; images: Opt[]; ctx: CondCtx;
  onSave: (i: Item, section: string | undefined, pageCondition?: { value: Condition | undefined }) => void; onDelete?: (() => void) | undefined; onClose: () => void;
}) {
  const [i, setI] = useState<Item>(item ?? { id: "", text: "", type: initialType ?? "single_choice", ...((initialType ?? "single_choice").endsWith("choice") ? { options: [] } : {}) });
  const [pageShow, setPageShow] = useState(page?.show_if);
  const [pageShowDirty, setPageShowDirty] = useState(false);
  const pageTarget = visibilityTarget(page) === "page";
  const effectivePage = page ? { ...page } : undefined;
  if (effectivePage) { if (pageShow) effectivePage.show_if = pageShow; else delete effectivePage.show_if; }
  const effectiveShow = effectiveVisibility(effectivePage, i);
  const [sec, setSec] = useState(section ?? "");
  const [lang, setLang] = useState<Lang>("nl");
  const [cond, setCond] = useState<CondTarget | null>(null);
  const simple = isSimpleRed(i);
  const [red, setRed] = useState<string[]>(() => (simple ? redAnswers(i) : []));
  const [redDirty, setRedDirty] = useState(false);
  const [adding, setAdding] = useState<{ text: string; red: boolean; exclusive: boolean } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const set = (patch: Record<string, unknown>) => setI((x) => ({ ...x, ...patch } as Item));
  const t = i.type;
  const hasOptions = t === "single_choice" || t === "multi_choice";
  const choiceType = hasOptions || t === "yes_no";
  const en = lang === "en";
  const optsEn = (i["options_en"] as string[] | undefined) ?? [];
  const sigMode = i.signal_if === undefined ? "none" : typeof i.signal_if === "string" && i.signal_if !== "any_except_exclusive" ? "value" : i.signal_if === "any_except_exclusive" ? "any" : Array.isArray(i.signal_if) ? "values" : "condition";
  const choices = answerValues(i);
  const ansLabel = (c: string) => (c === "yes" ? "Ja" : c === "no" ? "Nee" : c);

  /** The item as it will be saved, with the per-answer red rule written when an outcome changed. */
  const current = (): Item => {
    const id = i.id || slug(i.text);
    const base = { ...i, id };
    const withRed = redDirty && simple ? { ...base, red_if: redRuleFor(base, red) } : base;
    return Object.fromEntries(Object.entries(withRed).filter(([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0 && v !== withRed.options))) as Item;
  };
  const toggleRed = (o: string) => { setRed((r) => (r.includes(o) ? r.filter((x) => x !== o) : [...r, o])); setRedDirty(true); };
  const rename = (idx: number, isExclusive: boolean, text: string) => {
    if (en) {
      if (isExclusive) set({ exclusive_option_en: text });
      else { const next = [...optsEn]; next[idx] = text; set({ options_en: next }); }
      return;
    }
    const old = isExclusive ? i.exclusive_option : i.options?.[idx];
    if (isExclusive) set({ exclusive_option: text });
    else set({ options: (i.options ?? []).map((x, j) => (j === idx ? text : x)) });
    if (old && red.includes(old)) { setRed(red.map((x) => (x === old ? text : x))); setRedDirty(true); }
  };
  const remove = (idx: number, isExclusive: boolean) => {
    const old = isExclusive ? i.exclusive_option : i.options?.[idx];
    if (isExclusive) set({ exclusive_option: undefined, exclusive_option_en: undefined });
    else set({ options: (i.options ?? []).filter((_, j) => j !== idx), options_en: optsEn.filter((_, j) => j !== idx) });
    if (old && red.includes(old)) { setRed(red.filter((x) => x !== old)); setRedDirty(true); }
  };
  const add = () => {
    if (!adding?.text.trim()) return;
    const text = adding.text.trim();
    if (adding.exclusive && t === "multi_choice") {
      const prev = i.exclusive_option;
      set({ exclusive_option: text, options: prev ? [...(i.options ?? []), prev] : i.options });
    } else set({ options: [...(i.options ?? []), text] });
    if (adding.red) { setRed([...red, text]); setRedDirty(true); }
    setAdding(null);
  };
  const moveOpt = (from: number, to: number) => {
    const o = [...(i.options ?? [])], e = [...optsEn];
    const [m] = o.splice(from, 1); if (m !== undefined) o.splice(to, 0, m);
    const [me] = e.splice(from, 1); if (me !== undefined) e.splice(to, 0, me);
    set({ options: o, ...(optsEn.length ? { options_en: e } : {}) });
  };

  const live = current();
  const noShow = ({ show_if: _s, ...x }: Item): Item => x;
  const pageBase = page ? (({ show_if: _a, red_if: _b, ...x }: Page) => x)(page) : undefined;
  const previewPage: Page = pageBase
    ? { ...pageBase, items: item ? (pageBase.items ?? []).map((x) => (x === item ? noShow(live) : x)) : [...(pageBase.items ?? []), noShow(live)] }
    : { id: "preview", ...(sec.trim() ? { section: sec.trim() } : {}), items: [noShow(live)] };
  const previewDef: QuestionnaireDef = { ...def, pages: [previewPage] };
  const today = new Date().toISOString().slice(0, 10);
  const sectionName = sec.trim() || page?.section;

  return (
    <>
      <Modal open width="xl" onOpenChange={(o) => !o && onClose()} title={`Vraag ${number} ${item ? "wijzigen" : "toevoegen"}`} description={`${questionnaireName}${sectionName ? ` · onderdeel ${sectionName}` : ""}`}
        footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!i.text.trim()} onClick={() => onSave(current(), sec.trim() || undefined, pageShowDirty ? { value: pageShow } : undefined)}>Opslaan</PillButton></div></div>}>
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-8">
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Select label="Onderdeel" value={sections.includes(sec) ? sec : sec ? "__new" : "__none"} onChange={(v) => setSec(v === "__none" ? "" : v === "__new" ? " " : v)} options={[{ value: "__none", label: "Geen" }, ...sections.map((s) => ({ value: s, label: s })), { value: "__new", label: "Nieuw onderdeel" }]} />
                {sec && !sections.includes(sec) && <TextField label="Naam onderdeel" value={sec.trim()} onChange={(e) => setSec(e.target.value || " ")} />}
              </div>
              <Select label="Type vraag" value={t} onChange={(v) => set({ type: v as ItemType })} options={itemTypes} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="shrink-0 text-[13px] font-medium whitespace-nowrap">Taal van de teksten</span>
                            <SegmentedControl className="shrink-0" label="Taal van de teksten" value={lang} onChange={setLang} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "Engels" }]} />
              <span className="basis-full text-xs leading-[1.4] text-muted-foreground">Vraag, toelichting en antwoorden hebben per taal een eigen veld; de voorwaarden en uitkomsten zijn gedeeld.</span>
            </div>
            <TextArea label="Vraag" rows={2} value={en ? String(i["text_en"] ?? "") : i.text} placeholder={en ? i.text : undefined} onChange={(e) => set(en ? { text_en: e.target.value } : { text: e.target.value })} />
            <TextArea label="Toelichting onder de vraag" rows={2} value={en ? String(i["help_en"] ?? "") : (i.help ?? "")} placeholder={en ? i.help : undefined} onChange={(e) => set(en ? { help_en: e.target.value } : { help: e.target.value })} help="Optioneel." />

            {choiceType && (
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium">Antwoorden en uitkomst</span>
                {choices.map((c) => {
                  const isEx = c === i.exclusive_option;
                  const idx = isEx ? -1 : (i.options ?? []).indexOf(c);
                  const text = t === "yes_no" ? ansLabel(c) : en ? (isEx ? String(i["exclusive_option_en"] ?? "") : (optsEn[idx] ?? "")) : c;
                  return (
                    <div key={`${c}-${idx}`} draggable={hasOptions && !isEx} onDragStart={() => setDrag(idx)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && idx >= 0 && drag !== idx) moveOpt(drag, idx); setDrag(null); }}
                      className="flex h-11 items-center gap-3 rounded-[12px] bg-sand px-4">
                      <span className={cn("text-xs text-muted-foreground", hasOptions && !isEx ? "cursor-grab" : "opacity-0")} aria-hidden="true">⋮⋮</span>
                      {t === "yes_no" ? <span className="flex-1 text-[15px]">{text}</span>
                        : <input aria-label="Tekst van het antwoord" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" value={text} placeholder={en ? c : undefined} onChange={(e) => rename(idx, isEx, e.target.value)} />}
                      {isEx && <span className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-background px-3 text-xs">− Sluit de rest uit</span>}
                      {simple && <button type="button" onClick={() => toggleRed(c)} className={cn("h-7 rounded-full px-3 text-xs", red.includes(c) ? "bg-warning-bg text-warning" : "bg-teal-light text-primary")}>{red.includes(c) ? "Rood" : "Groen"}</button>}
                      {hasOptions && <button type="button" aria-label="Antwoord verwijderen" onClick={() => remove(idx, isEx)} className="rounded-full p-1 text-muted-foreground hover:bg-background"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
                    </div>
                  );
                })}
                {hasOptions && adding && (
                  <div className="flex flex-col gap-3 rounded-[14px] border border-primary p-4">
                    <input autoFocus aria-label="Tekst van het antwoord" placeholder="Tekst van het antwoord" className={inputCls} value={adding.text} onChange={(e) => setAdding({ ...adding, text: e.target.value })} onKeyDown={(e) => e.key === "Enter" && add()} />
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-[13px]">Uitkomst</span>
                      <SegmentedControl label="Uitkomst" value={adding.red ? "red" : "green"} onChange={(v) => setAdding({ ...adding, red: v === "red" })} options={[{ value: "green", label: "Groen" }, { value: "red", label: "Rood" }]} />
                      {t === "multi_choice" && <Checkbox label="Sluit andere antwoorden uit" checked={adding.exclusive} onChange={(v) => setAdding({ ...adding, exclusive: v })} />}
                      <div className="ml-auto flex gap-2"><PillButton size="sm" variant="outline" onClick={() => setAdding(null)}>Annuleren</PillButton><PillButton size="sm" disabled={!adding.text.trim()} onClick={add}>Toevoegen</PillButton></div>
                    </div>
                  </div>
                )}
                {hasOptions && !adding && (
                  <div><button type="button" onClick={() => setAdding({ text: "", red: false, exclusive: false })} className="inline-flex h-9 items-center gap-2 rounded-full border border-dashed border-primary px-4 text-[13px] text-primary"><PlusIcon />Antwoord</button></div>
                )}
                <p className="text-xs leading-[1.6] text-muted-foreground">Per antwoord kies je de uitkomst en of het de andere antwoorden uitsluit. Kiest de patiënt “Geen van deze”, dan gaan de andere vinkjes uit; kiest de patiënt daarna een aandoening, dan gaat “Geen van deze” weer uit. Bij één keuze per vraag is dit niet nodig.</p>
              </div>
            )}
            {(!choiceType || !simple) && (
              <ConditionLine label="Rood als" empty="Nooit" value={i.red_if} ctx={ctx}
                onEdit={() => setCond({ key: "red", title: `Wanneer is vraag ${number} rood?`, always: "Nooit rood", value: i.red_if, set: (c) => { set({ red_if: c }); setRed(c ? redAnswers({ ...i, red_if: c }) : []); setRedDirty(false); } })} />
            )}
            {(i.red_if || red.length > 0) && <Select label="Afwijzingsscherm" value={i.red_variant ?? "__auto"} onChange={(v) => set({ red_variant: v === "__auto" ? undefined : v })} options={[{ value: "__auto", label: "Automatisch kiezen" }, ...rejections]} />}

            {(t === "number" || t === "measure_with_image") && <TextField label="Eenheid" value={i.unit ?? ""} onChange={(e) => set({ unit: e.target.value })} />}
            {t === "measure_with_image" && <>
              <Select label="Afbeelding" value={i.image ?? "__none"} onChange={(v) => set({ image: v === "__none" ? undefined : v })} options={[{ value: "__none", label: "Geen" }, ...images, ...(i.image && !images.some((x) => x.value === i.image) ? [{ value: i.image, label: i.image }] : [])]} help="Bij een maat, zoals buikomvang, zet je hier de foto." />
              <TextField label="Antwoord als de patiënt het niet weet" value={en ? String(i["allow_unknown_en"] ?? "") : (i.allow_unknown ?? "")} placeholder={en ? i.allow_unknown : undefined} onChange={(e) => set(en ? { allow_unknown_en: e.target.value } : { allow_unknown: e.target.value })} />
            </>}
            <Checkbox label="Optioneel (mag leeg blijven)" checked={!!i.optional} onChange={(v) => set({ optional: v || undefined })} />

            <ConditionLine label="Tonen" empty="Altijd" value={effectiveShow} ctx={ctx} help="Of alleen als een eerdere vraag een bepaald antwoord heeft."
              onEdit={() => setCond({ key: "show", title: `Wanneer tonen we vraag ${number}, ${shortName(i.text)}?`, always: "Altijd tonen", value: pageTarget ? pageShow : i.show_if, set: (c) => { if (pageTarget) { setPageShow(c); setPageShowDirty(true); } else set({ show_if: c }); } })} />

            {!pageTarget && pageShow && <p className="text-xs text-muted-foreground">De paginavoorwaarde blijft ook van toepassing.</p>}

            <div className="grid grid-cols-2 gap-4">
              <Select label="Signaal voor de arts" value={sigMode} onChange={(m) => set({ signal_if: m === "none" ? undefined : m === "any" ? "any_except_exclusive" : m === "value" ? (choices[0] ?? "yes") : m === "values" ? [] : { all: [] } })}
                options={[{ value: "none", label: "Geen signaal" }, ...(t === "multi_choice" ? [{ value: "any", label: "Bij elk antwoord behalve het uitsluitende" }] : []), ...(t === "yes_no" ? [{ value: "value", label: "Bij één antwoord" }] : []), ...(hasOptions ? [{ value: "values", label: "Bij gekozen antwoorden" }] : []), { value: "condition", label: "Onder een voorwaarde" }]} />
              {i.signal_if !== undefined && <TextField label="Naam van het signaal" value={i.signal_label ?? ""} onChange={(e) => set({ signal_label: e.target.value })} />}
              {sigMode === "value" && <Select label="Antwoord" value={String(i.signal_if)} onChange={(v) => set({ signal_if: v })} options={choices.map((c) => ({ value: c, label: ansLabel(c) }))} />}
            </div>
            {sigMode === "values" && <div className="flex flex-col gap-2">{choices.map((c) => <Checkbox key={c} label={c} checked={(i.signal_if as string[]).includes(c)} onChange={(on) => set({ signal_if: on ? [...(i.signal_if as string[]), c] : (i.signal_if as string[]).filter((x) => x !== c) })} />)}</div>}
            {sigMode === "condition" && <ConditionLine label="Signaal als" empty="Nooit" value={(i.signal_if as Condition).all?.length || (i.signal_if as Condition).any?.length ? (i.signal_if as Condition) : undefined} ctx={ctx}
              onEdit={() => setCond({ key: "signal", title: `Wanneer krijgt de arts een signaal bij vraag ${number}?`, always: "Altijd", value: i.signal_if as Condition, set: (c) => set({ signal_if: c ?? { all: [] } }) })} />}
            <p className="text-xs leading-[1.6] text-muted-foreground">Kiest de patiënt een rood antwoord, dan vervalt de afspraak en volgt het afwijzingsscherm. Bij “Geen van deze” gaat de patiënt door.</p>
          </div>

          <aside className="flex flex-col gap-3">
            <div className="text-[15px] font-semibold">Voorbeeld voor de patiënt</div>
            <p className="text-xs leading-[1.5] text-muted-foreground">Vraag {number} zoals de patiënt hem ziet. Het voorbeeld rekent mee.</p>
            <div className="h-[523px] w-[242px] overflow-hidden rounded-[18px]">
              <div className="origin-top-left scale-[0.62]">
                <QuestionnaireRunner key={lang} flow={flow} def={previewDef} ui={ui} today={today} lang={lang} initial={{ height_cm: 178, weight_kg: 88 }} />
              </div>
            </div>
            {page && <Link to="/boekingsflow/vragenlijsten/$id/test" params={{ id: questionnaireId }} search={{ pagina: page.id }} target="_blank" className="text-sm text-primary underline">Open het klikbare scherm</Link>}
          </aside>
        </div>
      </Modal>
      {cond && <ConditionModal title={cond.title} description={questionnaireName} alwaysLabel={cond.always} value={cond.value} ctx={ctx} outcome={cond.key === "signal" ? "signal" : cond.key === "red" ? "red" : "show"} onClose={() => setCond(null)} onSave={(c) => { cond.set(c); setCond(null); }} />}
    </>
  );
}

/** Thresholds: numeric settings, standard and reduced side by side. */
export function ThresholdsModal({ settings, rows, names, onSave, onClose }: { settings: Record<string, unknown>; rows: Array<{ label: string; std: string; red: string }>; names: Record<string, string>; onSave: (s: Record<string, unknown>, names: Record<string, string>) => void; onClose: () => void }) {
  const [labels, setLabels] = useState(names);
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
    <input inputMode="decimal" aria-label={labels[p] || "Grenswaarde"} className="h-11 w-full rounded-[12px] bg-sand px-3 text-[15px] outline-none" defaultValue={String(get(p) ?? "").replace(".", ",")} onChange={(e) => { const n = Number(e.target.value.replace(",", ".")); if (!Number.isNaN(n)) put(p, n); }} />
  );
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title="Grenswaarden wijzigen" description="Gelden direct voor nieuwe antwoorden."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => onSave(s, labels)}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-[1fr_140px_140px] items-center gap-3 text-sm">
        <span className="text-xs text-muted-foreground">Naam</span><span className="text-xs text-muted-foreground">Standaard</span><span className="text-xs text-muted-foreground">Verlaagd</span>
        {rows.map((r) => <div key={r.label} className="contents"><TextField label="Naam" value={labels[r.std] ?? r.label} onChange={(e) => setLabels({ ...labels, [r.std]: e.target.value, ...(r.red !== r.std ? { [r.red]: `${e.target.value} (verlaagd)` } : {}) })} />{num(r.std)}{num(r.red)}</div>)}
      </div>
    </Modal>
  );
}

export function ComputedModal({ name, displayName, formula, sample, onSave, onDelete, onClose }: { name: string | null; displayName: string; formula: string; sample: (f: string) => string; onSave: (n: string, f: string, label: string) => void; onDelete?: (() => void) | undefined; onClose: () => void }) {
  const [n, setN] = useState(displayName);
  const [f, setF] = useState(formula);
  let check = "";
  try { evaluate(f, { today: "2026-01-01", lookup: () => 1 }); check = sample(f); } catch (e) { check = e instanceof Error ? e.message : "Formule klopt niet"; }
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={name ? "Berekend veld wijzigen" : "Berekend veld toevoegen"} description="Velden tussen accolades, bijvoorbeeld {weight_kg}."
      footer={<div className="flex w-full items-center justify-between">{onDelete ? <TextLink tone="warning" onClick={onDelete}>Verwijderen</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!n.trim() || !f.trim()} onClick={() => onSave(name ?? slug(n), f, n.trim())}>Opslaan</PillButton></div></div>}>
      <div className="flex flex-col gap-4">
        <TextField label="Naam" value={n} onChange={(e) => setN(e.target.value)} />
        <TextField label="Formule" value={f} onChange={(e) => setF(e.target.value)} className="font-mono" />
        <p className="text-[13px] text-muted-foreground">Voorbeeld: {check}</p>
      </div>
    </Modal>
  );
}

export type PublishVersion = { id: string; version_no: number; status: string; note: string | null; published_at: string | null; updated_at: string; answers: number };

const fmtDate = (iso: string, time = false) => new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).replace(".", "");
const changedAt = (iso: string) => {
  const d = new Date(iso), today = new Date();
  const t = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return d.toDateString() === today.toDateString() ? `vandaag ${t}` : fmtDate(iso, true);
};

/** Versions and publishing (vragenlijst-publiceren.dc.html): Concept / Live / Archief, running answers, the changes, test/export/import. */
export function PublishModal({ name, versions, draftNo, liveNo, running, changes, changeCount, testLink, busy, onExport, onImport, onDiscard, onPublish, onClose }: {
  name: string; versions: PublishVersion[]; draftNo: number; liveNo: number | null; running: number; changes: string; changeCount: number; testLink: ReactNode; busy: boolean;
  onExport: () => void; onImport: (file: File) => void; onDiscard?: (() => void) | undefined; onPublish: () => void; onClose: () => void;
}) {
  const file = useRef<HTMLInputElement>(null);
  const pill = (status: string) => (status === "draft" ? "Concept" : status === "published" ? "Live" : "Archief");
  return (
    <Modal open width="lg" onOpenChange={(o) => !o && onClose()} title={`${name} · versies en publiceren`} description={`Concept v${draftNo} staat klaar${liveNo ? `; live is v${liveNo}` : ""}`}
      footer={<div className="flex w-full items-center justify-between">{onDiscard ? <TextLink tone="warning" onClick={onDiscard}>Concept weggooien</TextLink> : <span />}<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={busy} onClick={onPublish}>Publiceer v{draftNo}</PillButton></div></div>}>
      <div className="flex flex-col gap-2">
        {versions.map((v) => (
          <div key={v.id} className={cn("flex items-center gap-4 rounded-[14px] px-4 py-3", v.status === "draft" ? "bg-teal-light" : "bg-sand")}>
            <span className="w-8 text-sm font-semibold">v{v.version_no}</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm">{v.status === "draft" ? `Concept${v.note ? `: ${v.note}` : ""}` : `Gepubliceerd ${v.published_at ? fmtDate(v.published_at, v.status === "published") : ""}`}</div>
              <div className="text-xs text-muted-foreground">
                {v.status === "draft" ? `Gewijzigd ${changedAt(v.updated_at)}${liveNo ? ` · ${changeCount} ${changeCount === 1 ? "wijziging" : "wijzigingen"} sinds v${liveNo}` : ""}`
                  : v.status === "published" ? `${v.answers.toLocaleString("nl-NL")} ${v.answers === 1 ? "patiënt doorliep" : "patiënten doorliepen"} deze versie; antwoorden blijven aan v${v.version_no} gekoppeld`
                    : "Vervangen; antwoorden bewaard"}
              </div>
            </div>
            <span className={cn("text-xs", v.status === "draft" ? "text-primary" : "text-muted-foreground")}>{pill(v.status)}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-4">
        <Select label="Publiceren" value="now" onChange={() => undefined} options={[{ value: "now", label: "Nu" }]} />
        <Select label="Lopende invullingen" value="finish_own" onChange={() => undefined} options={[{ value: "finish_own", label: `Maken de oude versie af; nieuwe starten in v${draftNo}` }]}
          help={liveNo ? `${running} ${running === 1 ? "patiënt is" : "patiënten zijn"} nu bezig met v${liveNo}.` : undefined} />
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <span className="text-[13px] font-medium">Wat verandert er voor de patiënt</span>
        <p className="rounded-[14px] bg-sand px-4 py-3 text-sm leading-[1.6]">{changes}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {testLink}
        <PillButton variant="outline" onClick={onExport}>Exporteren als JSON</PillButton>
        <PillButton variant="outline" onClick={() => file.current?.click()}>Importeren</PillButton>
        <input ref={file} type="file" accept="application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
      </div>
      <p className="mt-4 text-xs leading-[1.6] text-muted-foreground">Elke antwoordset bewaart het versienummer. Een gepubliceerde versie wijzig je nooit; je maakt een nieuw concept. Testen opent de flow met testdata, zonder iets op te slaan.</p>
    </Modal>
  );
}
