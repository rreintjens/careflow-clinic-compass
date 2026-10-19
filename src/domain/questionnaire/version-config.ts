import type { QuestionnaireDef, FlowFile } from "./engine";

export type VersionConfig = Pick<FlowFile, "settings" | "computed_fields"> & { field_names?: unknown };
/** A version is authoritative; fallback only supports legacy import files. */
export function versionConfig(value: unknown, fallback: unknown = {}): VersionConfig {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const old = fallback && typeof fallback === "object" ? fallback as Record<string, unknown> : {};
  return {
    settings: (raw["settings"] ?? old["settings"] ?? {}) as Record<string, unknown>,
    computed_fields: (raw["computed_fields"] ?? old["computed_fields"] ?? {}) as Record<string, string>,
    field_names: raw["field_names"] ?? old["field_names"] ?? {},
  };
}
export const configOfDefinition = (def: QuestionnaireDef, fallback: unknown) => versionConfig(def["version_config"], fallback);

export function configurationChanges(live: unknown, draft: unknown, names: Record<string, string> = {}): string[] {
  const a = versionConfig(live), b = versionConfig(draft);
  const flatten = (obj: Record<string, unknown>, prefix = ""): Record<string, unknown> => Object.fromEntries(Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v) ? Object.entries(flatten(v as Record<string, unknown>, path)) : [[path, v]];
  }));
  const old = flatten(a.settings), cur = flatten(b.settings);
  const labels: Record<string, string> = {
    "bmi.direct_from": "BMI vanaf waar direct door", "bmi.direct_from_reduced": "BMI vanaf waar direct door (verlaagd)",
    "bmi.waist_from": "BMI vanaf waar de buikomvang telt", "bmi.waist_from_reduced": "BMI vanaf waar de buikomvang telt (verlaagd)",
    "bmi.red_below": "BMI-ondergrens", "waist_cm.male_min": "Minimale buikomvang man", "waist_cm.male_min_reduced": "Minimale buikomvang man (verlaagd)",
    "waist_cm.female_min": "Minimale buikomvang vrouw", "waist_cm.female_min_reduced": "Minimale buikomvang vrouw (verlaagd)",
  };
  const out: string[] = [];
  const display = (v: unknown) => v === undefined ? "niet ingesteld" : String(v).replace(".", ",");
  for (const k of new Set([...Object.keys(old), ...Object.keys(cur)])) if (JSON.stringify(old[k]) !== JSON.stringify(cur[k])) out.push(`${names[k] || labels[k] || "Instelling"}: ${display(old[k])} wordt ${display(cur[k])}`);
  if (JSON.stringify(a.computed_fields) !== JSON.stringify(b.computed_fields)) out.push("De berekening van velden is gewijzigd");
  if (JSON.stringify(a.field_names) !== JSON.stringify(b.field_names)) out.push("De namen van instellingen of berekende velden zijn gewijzigd");
  return out;
}