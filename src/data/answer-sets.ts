import { supabase } from "@/integrations/supabase/client";
import { answerSignals } from "@/domain/questionnaire/answers";
import type { Answers, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { zonedParts } from "@/domain/time";

/** Frozen-version signals shared by dossier, agenda and Mijn dag. RLS applies. */
export async function withAnswerSignals<T extends { version_id: string | null; answers: unknown; signals: unknown; status: string; created_at: string }>(sets: T[]) {
  const ids = [...new Set(sets.flatMap((s) => s.version_id ? [s.version_id] : []))];
  if (!ids.length) return sets;
  const result = await supabase.from("questionnaire_versions").select("id, definition, version_config").in("id", ids);
  if (result.error) throw result.error;
  const versions = new Map((result.data ?? []).map((v) => [v.id, v]));
  return sets.map((s) => {
    const v = s.version_id ? versions.get(s.version_id) : undefined;
    if (!v || s.status !== "completed") return s;
    return { ...s, signals: answerSignals(v.definition as unknown as QuestionnaireDef, v.version_config, (s.answers ?? {}) as Answers, zonedParts(new Date(s.created_at), "Europe/Amsterdam").date) };
  });
}