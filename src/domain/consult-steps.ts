/** Consult steps: pure rules for the consult page built from a dossier template. */
import type { TemplateContent } from "./dossier-templates";

/** Everything the consult page stores, kept in consult_notes.step_data. */
export interface StepData {
  libraryAnswers: Record<string, string>;
  diagnoses: string[];
  discussed: Record<string, { answer: "ja" | "nee"; by: string; at: string }>;
  vat: { exempt: boolean; answers: Record<string, string>; by: string; at: string } | null;
  lines: Array<{ treatmentId: string; name: string; qty: number; unit: string; priceCents: number; lot: { number: string; expiryMonth: string; expiryYear: string; uniqueCode: string } | null }>;
  drawing: { image: string; points: Array<{ x: number; y: number; units: number }> } | null;
  transcript: { status: "idle" | "recording" | "proposal" | "reviewed"; proposal: string } ;
  closing: {
    gpChannel: string; gpCopyToPortal: boolean; gpLetter: string;
    patientNote: string; aftercare: string; reminderDays: number; receptionNote: string;
  };
}

export const emptyStepData = (): StepData => ({
  libraryAnswers: {}, diagnoses: [], discussed: {}, vat: null, lines: [], drawing: null,
  transcript: { status: "idle", proposal: "" },
  closing: { gpChannel: "none", gpCopyToPortal: false, gpLetter: "", patientNote: "", aftercare: "", reminderDays: 0, receptionNote: "" },
});

export function readStepData(raw: unknown): StepData {
  const d = (raw && typeof raw === "object" ? raw : {}) as Partial<StepData>;
  return { ...emptyStepData(), ...d, transcript: { ...emptyStepData().transcript, ...(d.transcript ?? {}) }, closing: { ...emptyStepData().closing, ...(d.closing ?? {}) } };
}

/** Prefill from the template when the consult starts: diagnoses, aftercare, patient note, reminder. */
export function prefillStepData(content: TemplateContent): StepData {
  const d = emptyStepData();
  d.diagnoses = [...content.diagnoses];
  d.closing.aftercare = content.aftercare;
  d.closing.patientNote = content.patientNote;
  d.closing.reminderDays = content.reminderDays;
  return d;
}

export interface CloseItem { key: string; label: string; done: boolean }

/** "Dossier sluiten" checklist, built from the template's required items. */
export function closeChecklist(content: TemplateContent, data: StepData, opts: { prescriptionSigned: boolean | null; photoCount: number; soepFilled: number }): CloseItem[] {
  const items: CloseItem[] = [];
  if (content.steps.includes("diagnose")) {
    items.push({ key: "diagnose", label: "Diagnose vastgelegd", done: data.diagnoses.length > 0 });
    const all = content.bespreekpunt.every((code) => data.discussed[code]);
    items.push({ key: "bespreekpunten", label: `Bespreekpunten beantwoord (${Object.keys(data.discussed).filter((k) => content.bespreekpunt.includes(k)).length}/${content.bespreekpunt.length})`, done: content.bespreekpunt.length === 0 || all });
  }
  if (content.steps.includes("behandeling")) {
    const lotNeeded = data.lines.some((l) => l.lot !== null || l.unit === "zones" || l.unit === "ml" || l.unit === "eenheden");
    const lotDone = data.lines.every((l) => l.lot?.number);
    items.push({ key: "lotnummer", label: "Lotnummer vastgelegd", done: data.lines.length === 0 || !lotNeeded || lotDone });
    items.push({ key: "fotos", label: "Foto's toegevoegd", done: opts.photoCount > 0 });
    const all = content.controle.every((code) => data.libraryAnswers[code]);
    items.push({ key: "controlevragen", label: `Controlevragen beantwoord (${Object.keys(data.libraryAnswers).filter((k) => content.controle.includes(k)).length}/${content.controle.length})`, done: content.controle.length === 0 || all });
  }
  if (content.steps.includes("plan_recept") && opts.prescriptionSigned !== null)
    items.push({ key: "recept", label: "Recept ondertekend en verstuurd", done: opts.prescriptionSigned });
  if (data.transcript.status !== "idle")
    items.push({ key: "verslag", label: "Gespreksverslag beoordeeld", done: data.transcript.status === "reviewed" });
  items.push({ key: "soep", label: "Consultverslag (SOEP) ingevuld", done: opts.soepFilled === 4 });
  return items;
}

/** GP letter with placeholders filled. */
export function gpLetterText(template: string, vars: { patient: string; datum: string; behandeling: string; diagnose: string; medicatie: string; arts: string }): string {
  return template.replace(/\{(patient|datum|behandeling|diagnose|medicatie|arts)\}/g, (m, k: keyof typeof vars) => vars[k] || "—");
}

/** Pharmacy route statuses in order; the mock advances one step per poll. */
export const PHARMACY_FLOW = ["verstuurd", "ontvangen", "klaargezet", "verzonden"] as const;
export function nextPharmacyStatus(current: string): string | null {
  const i = (PHARMACY_FLOW as readonly string[]).indexOf(current);
  return i >= 0 && i < PHARMACY_FLOW.length - 1 ? PHARMACY_FLOW[i + 1]! : null;
}

/** Euro display for treatment lines. */
export const euros = (cents: number) => `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
export const lineTotal = (lines: StepData["lines"]) => lines.reduce((s, l) => s + l.qty * l.priceCents, 0);
