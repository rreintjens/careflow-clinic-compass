import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { readContent, type LibraryQuestion, type TemplateContent } from "@/domain/dossier-templates";

export type LibraryRow = LibraryQuestion & { id: string; is_example: boolean; sort: number };
export type TemplateVersionRow = { id: string; template_id: string; version: number; status: "concept" | "live" | "archived"; content: TemplateContent; change_note: string | null; published_at: string | null; published_by: string | null; updated_at: string; updated_by: string | null };

const ok = async <T,>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> => { const r = await p; if (r.error) throw new Error(r.error.message); return r.data as T; };

export const libraryQuery = queryOptions({
  queryKey: ["library-questions"],
  queryFn: async () => (await ok(supabase.from("library_questions").select("*").order("sort").order("code"))).map((r) => ({ ...r, options: (r.options ?? []) as LibraryRow["options"], condition: r.condition as LibraryRow["condition"] })) as LibraryRow[],
});

export const templatesQuery = queryOptions({
  queryKey: ["dossier-templates"],
  queryFn: async () => {
    const [templates, versions, categories] = await Promise.all([
      ok(supabase.from("dossier_templates").select("id, name, category_id, updated_at").order("name")),
      ok(supabase.from("dossier_template_versions").select("*").order("version", { ascending: false })),
      ok(supabase.from("treatment_categories").select("id, name_nl, parent_id").order("sort")),
    ]);
    return { templates, versions: versions.map((v) => ({ ...v, content: readContent(v.content) })) as TemplateVersionRow[], categories };
  },
});

export const categoryLabel = (cats: Array<{ id: string; name_nl: string; parent_id: string | null }>, id: string) => {
  const c = cats.find((x) => x.id === id); const p = c?.parent_id ? cats.find((x) => x.id === c.parent_id) : undefined;
  return c ? (p ? `${p.name_nl} › ${c.name_nl}` : c.name_nl) : "";
};

export const liveOf = (vs: TemplateVersionRow[], tid: string) => vs.find((v) => v.template_id === tid && v.status === "live");
export const conceptOf = (vs: TemplateVersionRow[], tid: string) => vs.find((v) => v.template_id === tid && v.status === "concept");

export async function createTemplate(categoryId: string, name: string) {
  const t = await ok(supabase.from("dossier_templates").insert({ category_id: categoryId, name }).select("id").single());
  await ok(supabase.from("dossier_template_versions").insert({ template_id: (t as { id: string }).id, version: 1, status: "concept", content: readContent({}) as unknown as Json, change_note: "Nieuw sjabloon" }));
  return (t as { id: string }).id;
}

export async function createConcept(templateId: string, from: TemplateVersionRow, versions: TemplateVersionRow[]) {
  const next = Math.max(0, ...versions.filter((v) => v.template_id === templateId).map((v) => v.version)) + 1;
  await ok(supabase.from("dossier_template_versions").insert({ template_id: templateId, version: next, status: "concept", content: from.content as unknown as Json, change_note: `Gebaseerd op versie ${from.version}` }));
  return next;
}

export async function saveConcept(id: string, content: TemplateContent) {
  await ok(supabase.from("dossier_template_versions").update({ content: content as unknown as Json }).eq("id", id).eq("status", "concept"));
}

export async function useAsConcept(from: TemplateVersionRow, concept: TemplateVersionRow | undefined, versions: TemplateVersionRow[]) {
  if (!concept) return createConcept(from.template_id, from, versions);
  await ok(supabase.from("dossier_template_versions").update({ content: from.content as unknown as Json, change_note: `Gebaseerd op versie ${from.version}` }).eq("id", concept.id).eq("status", "concept"));
  return concept.version;
}

/** Publishing archives the live version; running consults keep the version id they started with. */
export async function publishTemplate(templateId: string, conceptId: string) {
  const { data: u } = await supabase.auth.getUser();
  await ok(supabase.from("dossier_template_versions").update({ status: "archived" }).eq("template_id", templateId).eq("status", "live"));
  await ok(supabase.from("dossier_template_versions").update({ status: "live", published_at: new Date().toISOString(), published_by: u.user?.id ?? null }).eq("id", conceptId));
}

/** Library usage across templates and questionnaires, shown as pills. */
export const libraryUsageQuery = queryOptions({
  queryKey: ["library-usage"],
  queryFn: async () => {
    const [qs, qv] = await Promise.all([
      ok(supabase.from("questionnaires").select("id, name")),
      ok(supabase.from("questionnaire_versions").select("questionnaire_id, status, definition").in("status", ["published", "draft"])),
    ]);
    return { questionnaires: qs, versions: qv };
  },
});

const OPTION_KEYS = ["library_question_type", "library_question_group", "library_condition_field", "library_condition_value", "dossier_step", "reask_days", "resign_months", "reminder_days"] as const;
export const dossierOptionsQuery = queryOptions({
  queryKey: ["dossier-options"],
  queryFn: async () => {
    return ok(supabase.from("option_lists").select("list_key, value, label_nl").in("list_key", [...OPTION_KEYS]).order("sort"));
  },
});
export const optsOf = (rows: Array<{ list_key: string; value: string; label_nl: string }>, key: (typeof OPTION_KEYS)[number]) => rows.filter((r) => r.list_key === key).map((r) => ({ value: r.value, label: r.label_nl }));
