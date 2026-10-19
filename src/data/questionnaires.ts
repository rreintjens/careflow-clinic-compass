import { queryOptions } from "@tanstack/react-query";

import type { FlowFile, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { joinFlow, splitFlow } from "@/domain/questionnaire/io";
import { versionConfig } from "@/domain/questionnaire/version-config";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

async function ok<T>(p: PromiseLike<{ data: T; error: unknown }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw error;
  return data as NonNullable<T>;
}

export const questionnairesQuery = queryOptions({
  queryKey: ["questionnaires"],
  queryFn: async () => {
    const [flows, qs, versions, uiTexts] = await Promise.all([
      ok(supabase.from("questionnaire_flows").select("*").order("created_at")),
      ok(supabase.from("questionnaires").select("*").order("sort")),
      ok(supabase.from("questionnaire_versions").select("*").order("version_no", { ascending: false })),
      ok(supabase.from("option_lists").select("value, label_nl, label_en").eq("list_key", "questionnaire_ui")),
    ]);
    return { flows, questionnaires: qs, versions, uiTexts: Object.fromEntries(uiTexts.map((t) => [t.value, t.label_nl])) as Record<string, string> };
  },
});
export type QData = Awaited<ReturnType<NonNullable<typeof questionnairesQuery.queryFn>>>;
export type QRow = QData["questionnaires"][number];
export type VersionRow = QData["versions"][number];

export const versionsOf = (d: QData, qid: string) => d.versions.filter((v) => v.questionnaire_id === qid);
export const publishedOf = (d: QData, qid: string) => versionsOf(d, qid).find((v) => v.status === "published");
export const draftOf = (d: QData, qid: string) => versionsOf(d, qid).find((v) => v.status === "draft");
/** The version the builder edits: the draft, else the published one (read-only until a draft is made). */
export const workingVersion = (d: QData, qid: string) => draftOf(d, qid) ?? publishedOf(d, qid) ?? versionsOf(d, qid)[0];
export const defOf = (v: VersionRow | undefined): QuestionnaireDef | null => v ? { ...(v.definition as unknown as QuestionnaireDef), version_config: v.version_config } : null;
export const flowOf = (d: QData, flowId: string) => d.flows.find((f) => f.id === flowId);

/** Imports a flow file: one flow row, one questionnaire per entry, each as a published version 1 (or a new draft when it exists). */
export async function importFlow(file: FlowFile, flowKey: string, publish: boolean) {
  const { document, questionnaires } = splitFlow(file);
  const existing = (await supabase.from("questionnaire_flows").select("id").eq("key", flowKey).maybeSingle()).data;
  let flowId = existing?.id;
  if (flowId) await ok(supabase.from("questionnaire_flows").update({ document: document as Json }).eq("id", flowId));
  else flowId = (await ok(supabase.from("questionnaire_flows").insert({ key: flowKey, document: document as Json }).select("id").single())).id;
  for (const [i, q] of questionnaires.entries()) {
    const row = (await supabase.from("questionnaires").select("id").eq("key", q.id).maybeSingle()).data;
    const qid = row?.id ?? (await ok(supabase.from("questionnaires").insert({ flow_id: flowId, key: q.id, name: q.name, moment: q.moment, sort: i }).select("id").single())).id;
    if (row) await ok(supabase.from("questionnaires").update({ name: q.name, moment: q.moment, sort: i, flow_id: flowId }).eq("id", qid));
    const versions = await ok(supabase.from("questionnaire_versions").select("id, version_no, status").eq("questionnaire_id", qid).order("version_no", { ascending: false }));
    const draft = versions.find((v) => v.status === "draft");
    const config = versionConfig(q["version_config"], document) as unknown as Json;
    if (draft) await ok(supabase.from("questionnaire_versions").update({ definition: q as unknown as Json, version_config: config }).eq("id", draft.id));
    else await ok(supabase.from("questionnaire_versions").insert({ questionnaire_id: qid, version_no: (versions[0]?.version_no ?? 0) + 1, status: "draft", definition: q as unknown as Json, version_config: config, note: "Geïmporteerd" }));
    if (publish) {
      const d = await ok(supabase.from("questionnaire_versions").select("id").eq("questionnaire_id", qid).eq("status", "draft").single());
      await publishVersion(qid, d.id);
    }
  }
  return flowId;
}

/** Export = flow document + the published (else working) definition of each questionnaire, in order. */
export function exportFlow(d: QData, flowId: string): FlowFile {
  const flow = flowOf(d, flowId);
  const defs = d.questionnaires.filter((q) => q.flow_id === flowId).map((q) => defOf(publishedOf(d, q.id) ?? workingVersion(d, q.id))).filter(Boolean) as QuestionnaireDef[];
  return joinFlow((flow?.document ?? {}) as Record<string, unknown>, defs);
}

export async function createDraft(qid: string, from: VersionRow) {
  const versions = await ok(supabase.from("questionnaire_versions").select("version_no").eq("questionnaire_id", qid).order("version_no", { ascending: false }).limit(1));
  await ok(supabase.from("questionnaire_versions").insert({ questionnaire_id: qid, version_no: (versions[0]?.version_no ?? 0) + 1, status: "draft", definition: from.definition, version_config: from.version_config, note: `Gebaseerd op versie ${from.version_no}` }));
}

/** "Als concept gebruiken": the concept becomes a copy of an older version; an existing concept is replaced. */
export async function useVersionAsDraft(qid: string, from: VersionRow, draft: VersionRow | undefined) {
  if (!draft) return createDraft(qid, from);
  await ok(supabase.from("questionnaire_versions").update({ definition: from.definition, version_config: from.version_config, note: `Gebaseerd op versie ${from.version_no}` }).eq("id", draft.id).eq("status", "draft"));
}

/** Display names of publishers and editors (members of the active tenant only). */
export const staffNamesQuery = (ids: string[]) => queryOptions({
  queryKey: ["staff-names", [...ids].sort()],
  enabled: ids.length > 0,
  queryFn: async () => Object.fromEntries((await ok(supabase.rpc("staff_names", { _ids: ids }))).map((r) => [r.id, r.full_name])) as Record<string, string>,
});

export async function saveDraft(versionId: string, def: QuestionnaireDef) {
  const { version_config, ...definition } = def;
  await ok(supabase.from("questionnaire_versions").update({ definition: definition as unknown as Json, ...(version_config ? { version_config: version_config as Json } : {}) }).eq("id", versionId).eq("status", "draft"));
  await ok(supabase.from("questionnaires").update({ name: def.name, moment: def.moment }).eq("key", def.id));
}

/** Publishing archives the previous published version; answers keep pointing at the version they used. */
export async function publishVersion(qid: string, versionId: string) {
  const { data: u } = await supabase.auth.getUser();
  await ok(supabase.from("questionnaire_versions").update({ status: "archived" }).eq("questionnaire_id", qid).eq("status", "published"));
  await ok(supabase.from("questionnaire_versions").update({ status: "published", published_at: new Date().toISOString(), published_by: u.user?.id ?? null }).eq("id", versionId));
}

export async function discardDraft(versionId: string) {
  await ok(supabase.from("questionnaire_versions").delete().eq("id", versionId).eq("status", "draft"));
}

export async function saveFlowDocument(flowId: string, document: Record<string, unknown>) {
  await ok(supabase.from("questionnaire_flows").update({ document: document as Json }).eq("id", flowId));
}

export async function createQuestionnaire(flowId: string, key: string, name: string, moment: string, sort: number) {
  const def: QuestionnaireDef = { id: key, name, moment, pages: [] };
  const flow = await ok(supabase.from("questionnaire_flows").select("document").eq("id", flowId).single());
  const q = await ok(supabase.from("questionnaires").insert({ flow_id: flowId, key, name, moment, sort }).select("id").single());
  await ok(supabase.from("questionnaire_versions").insert({ questionnaire_id: q.id, version_no: 1, status: "draft", definition: def as unknown as Json, version_config: versionConfig(flow.document) as unknown as Json }));
  return q.id;
}

/** Treatments linked to a questionnaire key (before or after booking). */
export async function linkTreatments(key: string, moment: string, treatmentIds: string[], allTreatments: Array<{ id: string; pre_questionnaire_key: string | null; post_questionnaire_key: string | null }>) {
  const col = moment === "after_booking" ? "post_questionnaire_key" : "pre_questionnaire_key";
  for (const t of allTreatments) {
    const has = t[col] === key;
    const want = treatmentIds.includes(t.id);
    if (has !== want) await ok(supabase.from("treatments").update(col === "post_questionnaire_key" ? { post_questionnaire_key: want ? key : null } : { pre_questionnaire_key: want ? key : null }).eq("id", t.id));
  }
}
