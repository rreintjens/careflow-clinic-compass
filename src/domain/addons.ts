import { children, descendants, type MenuData, type Parent } from "./menu";

/**
 * Toevoeging: one extra question after choosing a treatment. Set on a group (inherited by every treatment of
 * kind "behandeling" below it) or on a treatment (override). Consults and controles never get one.
 */
export type Addon =
  | { type: "none" }
  | { type: "consult"; minutes: number }
  | { type: "pakket"; label: string; price_eur: number; question: string };
/** What the patient chose; stored on the appointment. */
export type AddonChoice = { type: "consult"; minutes: number } | { type: "pakket"; label: string; price_eur: number };

export const ADDON_MINUTES = [15, 30, 45] as const;

export function parseAddon(v: unknown): Addon | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o["type"] === "none") return { type: "none" };
  if (o["type"] === "consult" && typeof o["minutes"] === "number" && o["minutes"] > 0) return { type: "consult", minutes: o["minutes"] };
  if (o["type"] === "pakket" && typeof o["label"] === "string" && typeof o["price_eur"] === "number")
    return { type: "pakket", label: o["label"], price_eur: o["price_eur"], question: typeof o["question"] === "string" ? o["question"] : "" };
  return null;
}

type Groups = ReadonlyArray<{ id: string; parent_id: string | null; addon?: unknown }>;

/** The group's own setting, else the nearest parent's; null when nothing is set on the way up. */
export function groupAddon(groups: Groups, groupId: Parent): Addon | null {
  let cur: Parent = groupId;
  for (let i = 0; cur && i < 50; i++) {
    const g = groups.find((x) => x.id === cur);
    const a = parseAddon(g?.addon);
    if (a) return a;
    cur = g?.parent_id ?? null;
  }
  return null;
}

/** Effective toevoeging for a treatment reached via `parent`; null = no extra question. Pakket is treatment-only. */
export function effectiveAddon(groups: Groups, treatment: { kind: string; addon?: unknown }, parent: Parent): Exclude<Addon, { type: "none" }> | null {
  if (treatment.kind !== "behandeling") return null;
  const own = parseAddon(treatment.addon);
  const a = own ?? groupAddon(groups, parent);
  if (!a || a.type === "none") return null;
  if (a.type === "pakket" && !own) return null;
  return a;
}

/** The group a treatment was reached through: the hint when it (or a group below it) holds the treatment, else its first placement. */
export function placementParent(m: MenuData, treatmentId: string, hint: Parent): Parent {
  const holds = (g: Parent) => children(m, g).some((x) => x.kind === "treatment" && x.id === treatmentId);
  if (hint) for (const g of descendants(m, hint)) if (holds(g)) return g;
  if (holds(null)) return null;
  return m.links.find((l) => l.treatment_id === treatmentId)?.category_id ?? null;
}

/** Ancestors from the top level down to (and including) the group. */
export function groupPath(groups: Groups, groupId: Parent): string[] {
  const out: string[] = [];
  let cur: Parent = groupId;
  for (let i = 0; cur && i < 50; i++) { out.unshift(cur); cur = groups.find((x) => x.id === cur)?.parent_id ?? null; }
  return out;
}

/** The treatment-type group (second level), or the top group when the treatment sits on the first level. */
export const typeGroup = (groups: Groups, parent: Parent): string | null => { const p = groupPath(groups, parent); return p[1] ?? p[0] ?? null; };

/** The nearest consult on the way up from the treatment's group, within its treatment-type group. */
export function consultFor(m: MenuData, groups: Groups, treatments: ReadonlyArray<{ id: string; kind: string }>, parent: Parent): string | null {
  const path = groupPath(groups, parent);
  const stop = Math.min(1, path.length - 1);
  for (let i = path.length - 1; i >= stop; i--) {
    const scope = descendants(m, path[i] as string);
    for (const g of scope) for (const it of children(m, g)) if (it.kind === "treatment" && treatments.find((t) => t.id === it.id)?.kind === "consult") return it.id;
  }
  return null;
}

/** Group name inside a sentence: lower case, brand names keep capitals, "definitief" dropped, a peeling gets "een". */
export function groupPhrase(name: string): string {
  const words = name.replace(/\s+definitief$/i, "").split(/\s+/).map((w, i) => (/[A-Z]/.test(w.slice(1)) || /\d/.test(w) || (i === 0 && /^[A-Z]{2,}/.test(w)) ? w : w.toLowerCase()));
  const s = words.join(" ");
  return /peeling$/i.test(s) ? `een ${s}` : s;
}

/** Minutes the appointment takes with the chosen toevoeging. */
export const addonMinutes = (base: number, choice: AddonChoice | null | undefined) => base + (choice?.type === "consult" ? choice.minutes : 0);

/** Short label for agenda and mails, e.g. "+ consult" or "All-in pakket: 3 behandelingen". */
export const addonLabel = (choice: unknown): string => {
  const c = parseAddon(choice);
  return c?.type === "consult" ? `+ consult (${c.minutes} min)` : c?.type === "pakket" ? c.label : "";
};

/** One line for admins about what the patient will see. */
export function addonExplain(a: Addon | null, inherited: boolean): string {
  if (!a || a.type === "none") return inherited ? "Geen extra vraag." : "De patiënt krijgt geen extra vraag.";
  if (a.type === "consult") return `De patiënt kiest of er een consult van ${a.minutes} minuten bij moet; alleen bij behandelingen, niet bij consulten en controles.`;
  return `De patiënt kiest tussen ${a.label} (€ ${a.price_eur}) en één behandeling.`;
}
