import { visibleChildren, type MenuData, type MenuItem } from "./menu";

/** Patient booking flow: which step to show, given what is chosen. Single-choice steps are skipped. */
export type ChoiceMode = "assigned" | "optional" | "required" | "fixed";
export interface Pick { cat?: string | undefined; sub?: string | undefined; t?: string | undefined; l?: string | undefined; p?: string | undefined; stap?: string | undefined }
export interface Catalog {
  menu: MenuData;
  treatments: Array<{ id: string; practitioner_choice: string }>;
  locationsFor: (treatmentId: string) => string[];
}
export type Step =
  | { kind: "menu"; group: string | null; items: MenuItem[] }
  | { kind: "location"; treatment: string; options: string[] }
  | { kind: "practitioner"; treatment: string; location: string; required: boolean }
  | { kind: "planner"; treatment: string; location: string; practitioner: string | null; canChoose: boolean }
  | { kind: "none" };

export function nextStep(c: Catalog, pick: Pick): Step {
  let { t, l } = pick;
  if (!t) {
    const ok = new Set(c.treatments.filter((x) => c.locationsFor(x.id).length > 0).map((x) => x.id));
    let group: string | null = pick.sub ?? pick.cat ?? null;
    for (let i = 0; i < 10 && !t; i++) {
      const items = visibleChildren(c.menu, group, (id) => ok.has(id));
      if (items.length === 0) return { kind: "none" };
      if (items.length > 1) return { kind: "menu", group, items };
      const only = items[0] as MenuItem;
      if (only.kind === "treatment") t = only.id;
      else group = only.id;
    }
    if (!t) return { kind: "none" };
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
