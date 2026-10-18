import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { mailImagePathSchema } from "./mail-images";

export type MailTemplate = Database["public"]["Tables"]["mail_templates"]["Row"];
export const mailBlockSchema = z.object({
  id: z.string().min(1), type: z.string().min(1), condition: z.string().min(1),
  title_nl: z.string(), title_en: z.string(),
  text_nl: z.string(), text_en: z.string(),
  button_nl: z.string(), button_en: z.string(),
  url: z.string(), image: z.string(), image_path: mailImagePathSchema.or(z.literal("")).optional(),
}).refine((b) => !b.image || /^https:\/\//.test(b.image), { path: ["image"], message: "Gebruik een beveiligde afbeeldingslink." });
export type MailBlock = z.infer<typeof mailBlockSchema>;
export const mailTemplateSchema = z.object({
  id: z.string().uuid().nullable(), name: z.string().trim().min(1), moment: z.string().min(1),
  scope: z.enum(["base", "category", "treatment"]), category_id: z.string().uuid().nullable(), treatment_id: z.string().uuid().nullable(),
  status: z.enum(["active", "draft", "archived"]), subject_nl: z.string(), subject_en: z.string(), description: z.string(),
  blocks: z.array(mailBlockSchema),
}).superRefine((v, ctx) => {
  const valid = v.scope === "base" ? !v.category_id && !v.treatment_id : v.scope === "category" ? !!v.category_id && !v.treatment_id : !!v.treatment_id && !v.category_id;
  if (!valid) ctx.addIssue({ code: "custom", path: ["scope"], message: "Kies een categorie of behandeling." });
  if (v.status === "active" && (!v.subject_nl.trim() || !v.blocks.length)) ctx.addIssue({ code: "custom", path: ["subject_nl"], message: "Vul een onderwerp in en voeg een blok toe voordat je activeert." });
});
export type MailInput = z.infer<typeof mailTemplateSchema>;
export function blocksOf(template: Pick<MailTemplate, "blocks">): MailBlock[] {
  const raw = Array.isArray(template.blocks) ? template.blocks.map((b) => ({ title_nl: "", title_en: "", text_nl: "", text_en: "", button_nl: "", button_en: "", url: "", image: "", ...(b && typeof b === "object" && !Array.isArray(b) ? b : {}) })) : [];
  const result = z.array(mailBlockSchema).safeParse(raw);
  return result.success ? result.data : [];
}
export function translated(nl: string | null, en: string | null, language: string) { return language === "en" && en?.trim() ? en : nl ?? ""; }
export function interpolate(text: string, values: Record<string, string>) {
  return text.replace(/\{([^{}]+)\}/g, (original, key: string) => values[key] ?? original);
}
export function resolveMail(templates: readonly MailTemplate[], moment: string, treatmentId: string, categoryIds: readonly string[], includeDraft = false) {
  const matching = templates.filter((t) => t.moment === moment && (t.status === "active" || (includeDraft && t.status === "draft")));
  return matching.find((t) => t.scope === "treatment" && t.treatment_id === treatmentId)
    ?? matching.find((t) => t.scope === "category" && t.category_id !== null && categoryIds.includes(t.category_id))
    ?? matching.find((t) => t.scope === "base") ?? null;
}
export type MailSituation = { online: boolean; existingPatient: boolean; questionnaire: boolean; preparation: boolean };
export function blockVisible(condition: string, situation: MailSituation) {
  switch (condition) {
    case "always": return true;
    case "online": return situation.online;
    case "clinic": return !situation.online;
    case "existing_patient": return situation.existingPatient;
    case "new_patient": return !situation.existingPatient;
    case "questionnaire": return situation.questionnaire;
    case "preparation": return situation.preparation;
    default: return false;
  }
}
export function safeMailUrl(value: string) {
  try { const url = new URL(value); return ["https:", "mailto:", "tel:"].includes(url.protocol) ? value : null; } catch { return null; }
}

/** Cancellation/no-show rule: a treatment overrides its category, the category overrides Algemeen. */
export interface CancelRule { cancel_until_hours: number | null; no_show_fee_eur: number | null }
export interface CancelDefaults { cancelHours: number; noShowCents: number }
export function cancelPolicy(treatment: CancelRule | null | undefined, category: CancelRule | null | undefined, defaults: CancelDefaults) {
  const hours = treatment?.cancel_until_hours ?? category?.cancel_until_hours ?? defaults.cancelHours;
  const feeCents = treatment?.no_show_fee_eur != null ? treatment.no_show_fee_eur * 100 : category?.no_show_fee_eur != null ? category.no_show_fee_eur * 100 : defaults.noShowCents;
  return { hours, feeCents };
}
const euro = (cents: number) => (cents % 100 === 0 ? `€${cents / 100}` : `€${(cents / 100).toFixed(2).replace(".", ",")}`);
/** Placeholder values for the Verhinderd block; the fee sentence stays empty when there is no fee. */
export function cancelPolicyValues(policy: { hours: number; feeCents: number }, noShowSentence: string) {
  const annuleringstermijn = `${policy.hours} uur`;
  const no_show_bedrag = policy.feeCents > 0 ? euro(policy.feeCents) : "";
  return { annuleringstermijn, no_show_bedrag, no_show_zin: policy.feeCents > 0 ? interpolate(noShowSentence, { annuleringstermijn, no_show_bedrag }) : "" };
}