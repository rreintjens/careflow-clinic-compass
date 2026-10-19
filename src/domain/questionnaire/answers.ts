import { collectSignals, makeCtx, type Answers, type Item, type QuestionnaireDef } from "./engine";
import { versionConfig } from "./version-config";

export function answerText(item: Item, answers: Answers): string {
  if (item.type === "height_weight") return [answers["height_cm"] != null ? `${answers["height_cm"]} cm` : "", answers["weight_kg"] != null ? `${answers["weight_kg"]} kg` : ""].filter(Boolean).join(", ");
  const value = answers[item.id];
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (value === "unknown") return item.allow_unknown ?? "Weet ik niet";
  if (item.type === "yes_no") return value === true || value === "yes" ? "Ja" : value === false || value === "no" ? "Nee" : String(value);
  if (item.type === "date_segmented" && typeof value === "string") return value.split("-").reverse().join("-");
  if (typeof value === "object") return Object.values(value).join(", ");
  return `${String(value)}${item.unit ? ` ${item.unit}` : ""}`;
}

/** Derive from the answered version, never today's published thresholds. */
export function answerSignals(definition: QuestionnaireDef, config: unknown, answers: Answers, today: string) {
  return collectSignals(definition, makeCtx(versionConfig(config), answers, today)).map((signal) => {
    const item = definition.pages.flatMap((p) => p.items ?? []).find((i) => i.id === signal.item);
    const value = answers[signal.item];
    return item?.unit && typeof value === "number" ? { ...signal, label: `${signal.label} (${value} ${item.unit})` } : signal;
  });
}