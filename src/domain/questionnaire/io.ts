/** JSON import/export of a flow file: flow-level document + one definition per questionnaire. */
import type { FlowFile, QuestionnaireDef } from "./engine";

export interface SplitFlow { document: Record<string, unknown>; questionnaires: QuestionnaireDef[] }

export function splitFlow(file: FlowFile): SplitFlow {
  const { questionnaires, ...document } = file;
  if (!Array.isArray(questionnaires)) throw new Error("Bestand mist 'questionnaires'");
  for (const q of questionnaires) {
    if (!q.id || !Array.isArray(q.pages)) throw new Error("Elke vragenlijst heeft een id en pagina's nodig");
  }
  return { document, questionnaires };
}

/** Rebuilds the file in the original top-level order (meta, settings, computed_fields, questionnaires, rest). */
export function joinFlow(document: Record<string, unknown>, questionnaires: QuestionnaireDef[]): FlowFile {
  const { meta, settings, computed_fields, ...rest } = document as Record<string, unknown>;
  return { meta, settings, computed_fields, questionnaires, ...rest } as FlowFile;
}

/** Deep equality that ignores object key order (jsonb does not keep it). */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => sameJson(x, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => sameJson((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}
