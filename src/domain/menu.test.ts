import { describe, expect, it } from "vitest";
import { canAddGroup, children, dissolvePlan, moveError, resolveIcon, visibleChildren, type MenuData } from "./menu";

// Botox › (Gezicht › Voorhoofd), Lasertherapie › Huid; Fillers › Ogen (one treatment)
const m: MenuData = {
  groups: [
    { id: "botox", parent_id: null, sort: 0 }, { id: "gezicht", parent_id: "botox", sort: 0 }, { id: "voorhoofd", parent_id: "gezicht", sort: 0 },
    { id: "laser", parent_id: null, sort: 1 }, { id: "huid", parent_id: "laser", sort: 0 },
    { id: "fillers", parent_id: null, sort: 2 }, { id: "ogen", parent_id: "fillers", sort: 0 }, { id: "lippen", parent_id: "fillers", sort: 1 },
  ],
  links: [
    { treatment_id: "ontharing", category_id: "laser", sort: 1 }, { treatment_id: "peeling", category_id: "huid", sort: 0 },
    { treatment_id: "wallen", category_id: "ogen", sort: 0 }, { treatment_id: "lip1", category_id: "lippen", sort: 0 }, { treatment_id: "lip2", category_id: "lippen", sort: 1 },
    { treatment_id: "frons", category_id: "voorhoofd", sort: 0 },
  ],
  roots: [{ treatment_id: "scan", sort: 1 }],
};

describe("menu tree", () => {
  it("mixes groups and treatments in one order", () =>
    expect(children(m, null)).toEqual([{ kind: "group", id: "botox" }, { kind: "group", id: "laser" }, { kind: "treatment", id: "scan" }, { kind: "group", id: "fillers" }]));
  it("refuses more than three group levels", () =>
    expect(moveError(m, { kind: "group", id: "botox" }, null, "huid", 3)).toBe("Kan niet: maximaal drie lagen groepen"));
  it("refuses a group into itself", () =>
    expect(moveError(m, { kind: "group", id: "botox" }, null, "voorhoofd", 9)).toBe("Kan niet: een groep kan niet in zichzelf"));
  it("refuses the same treatment twice in one parent", () =>
    expect(moveError(m, { kind: "treatment", id: "lip1" }, "lippen", "lippen", 3)).toBeNull());
  it("refuses a duplicate placement", () =>
    expect(moveError(m, { kind: "treatment", id: "peeling" }, null, "huid", 3)).toBe("Kan niet: deze behandeling staat hier al"));
  it("allows a treatment to the top level", () =>
    expect(moveError(m, { kind: "treatment", id: "ontharing" }, "laser", null, 3)).toBeNull());
  it("a group with one item keeps its own tile", () =>
    expect(visibleChildren(m, "fillers", () => true)).toEqual([{ kind: "group", id: "ogen" }, { kind: "group", id: "lippen" }]));
  it("new group only under depth limit", () => {
    expect(canAddGroup(m, "voorhoofd", 3)).toBe(false);
    expect(canAddGroup(m, "gezicht", 3)).toBe(true);
  });
  it("icon falls back to nearest parent, then default", () => {
    const icons: Record<string, string> = { botox: "botox" };
    const d = { ...m, groupIcon: (id: string) => icons[id] };
    expect(resolveIcon(d, null, "voorhoofd", "ui:blad")).toEqual({ icon: "botox", inherited: true });
    expect(resolveIcon(d, null, null, "ui:blad")).toEqual({ icon: "ui:blad", inherited: true });
    expect(resolveIcon(d, "tabler:heart", "voorhoofd", "ui:blad")).toEqual({ icon: "tabler:heart", inherited: false });
  });
  it("dissolving moves contents one level up at the group's place", () =>
    expect(dissolvePlan(m, "laser").order).toEqual([{ kind: "group", id: "botox" }, { kind: "group", id: "huid" }, { kind: "treatment", id: "ontharing" }, { kind: "treatment", id: "scan" }, { kind: "group", id: "fillers" }]));
});
