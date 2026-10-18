import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

export type MailTemplate = Database["public"]["Tables"]["mail_templates"]["Row"];
export const mailBlockSchema = z.object({
  id: z.string().min(1), type: z.string().min(1), condition: z.string().min(1),
  title_nl: z.string().default(""), title_en: z.string().default(""),
  text_nl: z.string().default(""), text_en: z.string().default(""),
  button_nl: z.string().default(""), button_en: z.string().default(""),
  url: z.string().default(""), image: z.string().default(""),
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
  const result = z.array(mailBlockSchema).safeParse(template.blocks);
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