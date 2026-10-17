/** Patient booking flow: which step to show, given what is chosen. Single-choice steps are skipped. */
export type ChoiceMode = "assigned" | "optional" | "required" | "fixed";
export interface Pick { cat?: string | undefined; sub?: string | undefined; t?: string | undefined; l?: string | undefined; p?: string | undefined; stap?: string | undefined }
export interface Catalog {
  categories: Array<{ id: string; parent_id: string | null }>;
  links: Array<{ treatment_id: string; category_id: string }>;
  treatments: Array<{ id: string; practitioner_choice: string }>;
  locationsFor: (treatmentId: string) => string[];
}
export type Step =
  | { kind: "category"; options: string[] }
  | { kind: "subcategory"; category: string; options: string[] }
  | { kind: "treatment"; category: string; options: string[] }
  | { kind: "location"; treatment: string; options: string[] }
  | { kind: "practitioner"; treatment: string; location: string; required: boolean }
  | { kind: "planner"; treatment: string; location: string; practitioner: string | null; canChoose: boolean }
  | { kind: "none" };

/** Treatments reachable under a category (directly or via its subcategories) that have a bookable location. */
export function treatmentsUnder(c: Catalog, categoryId: string): string[] {
  const ids = new Set([categoryId, ...c.categories.filter((x) => x.parent_id === categoryId).map((x) => x.id)]);
  const ok = new Set(c.treatments.filter((t) => c.locationsFor(t.id).length > 0).map((t) => t.id));
  return [...new Set(c.links.filter((l) => ids.has(l.category_id) && ok.has(l.treatment_id)).map((l) => l.treatment_id))];
}

export function nextStep(c: Catalog, pick: Pick): Step {
  let { cat, sub, t, l } = pick;
  if (!t) {
    if (!cat) {
      const tops = c.categories.filter((x) => !x.parent_id && treatmentsUnder(c, x.id).length > 0).map((x) => x.id);
      if (tops.length === 0) return { kind: "none" };
      if (tops.length > 1) return { kind: "category", options: tops };
      cat = tops[0];
    }
    const subs = c.categories.filter((x) => x.parent_id === cat && treatmentsUnder(c, x.id).length > 0).map((x) => x.id);
    if (!sub && subs.length > 1) return { kind: "subcategory", category: cat as string, options: subs };
    const scope = sub ?? (subs.length === 1 ? subs[0] : cat) as string;
    const direct = sub || subs.length === 1
      ? treatmentsUnder(c, scope)
      : treatmentsUnder(c, cat as string);
    if (direct.length === 0) return { kind: "none" };
    if (direct.length > 1) return { kind: "treatment", category: scope, options: direct };
    t = direct[0];
  }
  const treatment = c.treatments.find((x) => x.id === t);
  if (!treatment) return { kind: "none" };
  const locs = c.locationsFor(treatment.id);
  if (!l) {
    if (locs.length === 0) return { kind: "none" };
    if (locs.length > 1) return { kind: "location", treatment: treatment.id, options: locs };
    l = locs[0];
  }
  const mode = treatment.practitioner_choice as ChoiceMode;
  const p = pick.p && pick.p !== "any" ? pick.p : null;
  if (mode === "assigned") return { kind: "planner", treatment: treatment.id, location: l as string, practitioner: null, canChoose: false };
  if (mode === "fixed") return p ? { kind: "planner", treatment: treatment.id, location: l as string, practitioner: p, canChoose: false } : { kind: "none" };
  if (mode === "required" && !p) return { kind: "practitioner", treatment: treatment.id, location: l as string, required: true };
  if (pick.stap === "wie") return { kind: "practitioner", treatment: treatment.id, location: l as string, required: mode === "required" };
  return { kind: "planner", treatment: treatment.id, location: l as string, practitioner: p, canChoose: true };
}

/** Online first, then the configured order. */
export function sortLocations<T extends { kind: string; sort: number }>(locs: readonly T[]): T[] {
  return [...locs].sort((a, b) => Number(b.kind === "online") - Number(a.kind === "online") || a.sort - b.sort);
}

/** "Morning" < 12:00, "afternoon" < 17:00, then evening. */
export const dayPart = (minute: number): "morning" | "afternoon" | "evening" => (minute < 720 ? "morning" : minute < 1020 ? "afternoon" : "evening");
