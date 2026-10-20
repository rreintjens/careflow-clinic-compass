import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";
import { questionnaireCodes, readContent, syncDefinition, templateUsesCode, type LibraryQuestion } from "@/domain/dossier-templates";
import type { QuestionnaireDef } from "@/domain/questionnaire/engine";

const librarySchema = z.object({
  id: z.string().uuid().nullable(),
  code: z.string().trim().regex(/^L\d{2,4}$/),
  text_nl: z.string().trim().min(1).max(500),
  text_en: z.string().trim().max(500).nullable(),
  qtype: z.string().min(1), grp: z.string().min(1),
  options: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).max(50),
  condition: z.object({ field: z.string().min(1), equals: z.string().min(1) }).nullable(),
});

/** Saves a library question; every template and questionnaire that uses it gets a concept with the change. */
export const saveLibraryQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => librarySchema.parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (!(await sb.rpc("is_aal2")).data || !(await sb.rpc("has_permission", { _perm: "library.manage" })).data) throw new Error("Geen toegang");
    const opts = await sb.from("option_lists").select("list_key, value").in("list_key", ["library_question_type", "library_question_group"]);
    const has = (k: string, v: string) => opts.data?.some((o) => o.list_key === k && o.value === v);
    if (!has("library_question_type", data.qtype) || !has("library_question_group", data.grp)) throw new Error("Ongeldige keuze");
    const row = { code: data.code, text_nl: data.text_nl, text_en: data.text_en, qtype: data.qtype, grp: data.grp, options: data.options as unknown as Json, condition: data.condition as unknown as Json };
    const saved = data.id ? await sb.from("library_questions").update(row).eq("id", data.id).select("id").single() : await sb.from("library_questions").insert(row).select("id").single();
    if (saved.error) throw new Error(saved.error.code === "23505" ? "Deze code bestaat al" : "Opslaan is niet gelukt");
    if (!data.id) return { id: saved.data.id, templates: 0, questionnaires: 0 };

    const q: LibraryQuestion = data;
    let templates = 0; let questionnaires = 0;
    const tv = await sb.from("dossier_template_versions").select("id, template_id, version, status, content").in("status", ["live", "concept"]);
    for (const tid of [...new Set((tv.data ?? []).map((v) => v.template_id))]) {
      const rows = (tv.data ?? []).filter((v) => v.template_id === tid);
      const live = rows.find((v) => v.status === "live"); const concept = rows.find((v) => v.status === "concept");
      if (!(concept ? templateUsesCode(readContent(concept.content), q.code) : live && templateUsesCode(readContent(live.content), q.code))) continue;
      templates += 1;
      if (!concept && live) {
        const all = await sb.from("dossier_template_versions").select("version").eq("template_id", tid);
        await sb.from("dossier_template_versions").insert({ template_id: tid, version: Math.max(0, ...(all.data ?? []).map((v) => v.version)) + 1, status: "concept", content: live.content, change_note: `Bibliotheekvraag ${q.code} gewijzigd` });
      }
    }
    const qv = await sb.from("questionnaire_versions").select("id, questionnaire_id, version_no, status, definition, version_config").in("status", ["published", "draft"]);
    for (const qid of [...new Set((qv.data ?? []).map((v) => v.questionnaire_id))]) {
      const rows = (qv.data ?? []).filter((v) => v.questionnaire_id === qid);
      const pub = rows.find((v) => v.status === "published"); const draft = rows.find((v) => v.status === "draft");
      const base = draft ?? pub; if (!base || !questionnaireCodes(base.definition as unknown as QuestionnaireDef).includes(q.code)) continue;
      questionnaires += 1;
      const def = syncDefinition(base.definition as unknown as QuestionnaireDef, q) as unknown as Json;
      if (draft) await sb.from("questionnaire_versions").update({ definition: def }).eq("id", draft.id).eq("status", "draft");
      else if (pub) {
        const all = await sb.from("questionnaire_versions").select("version_no").eq("questionnaire_id", qid);
        await sb.from("questionnaire_versions").insert({ questionnaire_id: qid, version_no: Math.max(0, ...(all.data ?? []).map((v) => v.version_no)) + 1, status: "draft", definition: def, version_config: pub.version_config, note: `Bibliotheekvraag ${q.code} gewijzigd` });
      }
    }
    return { id: saved.data.id, templates, questionnaires };
  });
