/** Question library + dossier templates: pure rules shared by admin, builder and consult. */
import type { Item, QuestionnaireDef } from "./questionnaire/engine";

export const SECTION_KEYS = ["anamnese", "fiscaal", "bespreekpunt", "controle"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export interface LibraryQuestion {
  code: string; text_nl: string; text_en?: string | null; qtype: string; grp: string;
  options: Array<{ value: string; label: string }>; condition?: { field: string; equals: string } | null;
}

export interface TemplateContent {
  steps: string[];
  questionnaire: { key: string | null; reaskDays: number };
  anamnese: string[]; fiscaal: string[]; bespreekpunt: string[]; controle: string[];
  diagnoses: string[]; consentForms: string[]; resignMonths: number;
  aftercare: string; patientNote: string; reminderDays: number; roomKind: string | null;
}

export const emptyContent = (): TemplateContent => ({
  steps: [], questionnaire: { key: null, reaskDays: 0 }, anamnese: [], fiscaal: [], bespreekpunt: [], controle: [],
  diagnoses: [], consentForms: [], resignMonths: 12, aftercare: "", patientNote: "", reminderDays: 0, roomKind: null,
});

export function readContent(raw: unknown): TemplateContent {
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<TemplateContent>;
  return { ...emptyContent(), ...c, questionnaire: { ...emptyContent().questionnaire, ...(c.questionnaire ?? {}) } };
}

export const templateUsesCode = (c: TemplateContent, code: string) => SECTION_KEYS.some((k) => c[k].includes(code));

/** Library codes used by a questionnaire definition (items carry library_code). */
export function questionnaireCodes(def: Pick<QuestionnaireDef, "pages"> | null | undefined): string[] {
  return (def?.pages ?? []).flatMap((p) => (p.items ?? []).map((i) => i["library_code"]).filter((x): x is string => typeof x === "string"));
}

/** A treatment in several categories gets the union of all live templates, deduplicated by library code. */
export function mergeTemplates(contents: TemplateContent[]): TemplateContent {
  const uniq = (xs: string[]) => [...new Set(xs)];
  const out = emptyContent();
  for (const c of contents) {
    out.steps = uniq([...out.steps, ...c.steps]);
    for (const k of SECTION_KEYS) out[k] = uniq([...out[k], ...c[k]]);
    out.diagnoses = uniq([...out.diagnoses, ...c.diagnoses]);
    out.consentForms = uniq([...out.consentForms, ...c.consentForms]);
    out.questionnaire = out.questionnaire.key ? out.questionnaire : c.questionnaire;
    out.aftercare = [out.aftercare, c.aftercare].filter(Boolean).join("\n\n");
    out.patientNote = [out.patientNote, c.patientNote].filter(Boolean).join("\n\n");
    out.reminderDays = Math.max(out.reminderDays, c.reminderDays);
    out.resignMonths = out.resignMonths && c.resignMonths ? Math.min(out.resignMonths, c.resignMonths) : out.resignMonths || c.resignMonths;
    out.roomKind = out.roomKind ?? c.roomKind;
  }
  return out;
}

/** Sentence shown when saving a library question that is in use. */
export function conceptMessage(templates: number, questionnaires: number): string | null {
  if (!templates && !questionnaires) return null;
  const parts = [templates && `${templates} ${templates === 1 ? "sjabloon" : "sjablonen"}`, questionnaires && `${questionnaires} ${questionnaires === 1 ? "vragenlijst" : "vragenlijsten"}`].filter(Boolean);
  return `Wijzigen maakt een concept van ${parts.join(" en ")}`;
}

const ITEM_TYPE: Record<string, Item["type"]> = { yes_no: "yes_no", yes_no_note: "yes_no", choice: "single_choice", multi: "multi_choice", number: "number", text_template: "text", discussion: "yes_no" };

/** Library question as a questionnaire item, linked by library_code. */
export function libraryItem(q: LibraryQuestion, id: string): Item {
  const type = ITEM_TYPE[q.qtype] ?? "text";
  return { id, type, text: q.text_nl, library_code: q.code, ...(type === "single_choice" || type === "multi_choice" ? { options: q.options.map((o) => o.label) } : {}),
    ...(q.condition ? { show_if: { all: [{ field: q.condition.field, op: "eq" as const, value: q.condition.equals }] } } : {}) };
}

/** Re-sync every linked item in a definition with the library (text and options only). */
export function syncDefinition<T extends Pick<QuestionnaireDef, "pages">>(def: T, q: LibraryQuestion): T {
  return { ...def, pages: def.pages.map((p) => ({ ...p, ...(p.items ? { items: p.items.map((i) => (i["library_code"] === q.code ? { ...i, ...libraryItem(q, i.id), show_if: i.show_if ?? libraryItem(q, i.id).show_if } : i)) } : {}) })) };
}

/** Next free L-code. */
export function nextCode(codes: string[]): string {
  const n = Math.max(0, ...codes.map((c) => Number(/^L(\d+)$/.exec(c)?.[1] ?? 0)));
  return `L${String(n + 1).padStart(2, "0")}`;
}
