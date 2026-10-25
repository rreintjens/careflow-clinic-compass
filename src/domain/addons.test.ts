import { describe, expect, it } from "vitest";

import { addonMinutes, consultFor, effectiveAddon, groupPhrase, placementParent, typeGroup } from "./addons";

const groups = [
  { id: "laser", parent_id: null, addon: { type: "consult", minutes: 15 } },
  { id: "ontharing", parent_id: "laser", addon: null },
  { id: "lichaam", parent_id: "ontharing", addon: null },
  { id: "verjonging", parent_id: "laser", addon: { type: "consult", minutes: 30 } },
  { id: "skin", parent_id: null, addon: null },
];
const m = {
  groups: groups.map((g, i) => ({ id: g.id, parent_id: g.parent_id, sort: i })),
  links: [{ treatment_id: "oksels", category_id: "lichaam", sort: 0 }, { treatment_id: "consult-ontharing", category_id: "ontharing", sort: 0 }, { treatment_id: "mild", category_id: "verjonging", sort: 0 }],
  roots: [],
};
const beh = { kind: "behandeling", addon: null };

describe("toevoegingen", () => {
  it("a group's consult is inherited by treatments of kind behandeling below it", () =>
    expect(effectiveAddon(groups, beh, "lichaam")).toEqual({ type: "consult", minutes: 15 }));
  it("a subgroup overrides with 30 minutes", () => expect(effectiveAddon(groups, beh, "verjonging")).toEqual({ type: "consult", minutes: 30 }));
  it("consults and controles never get one", () => {
    expect(effectiveAddon(groups, { kind: "consult", addon: null }, "lichaam")).toBeNull();
    expect(effectiveAddon(groups, { kind: "controle", addon: null }, "lichaam")).toBeNull();
  });
  it("a treatment can switch it off", () => expect(effectiveAddon(groups, { kind: "behandeling", addon: { type: "none" } }, "lichaam")).toBeNull());
  it("pakket only on the treatment itself", () =>
    expect(effectiveAddon(groups, { kind: "behandeling", addon: { type: "pakket", label: "All-in pakket: 3 behandelingen", price_eur: 1000, question: "Wil je het all-in pakket?" } }, "skin"))
      .toEqual({ type: "pakket", label: "All-in pakket: 3 behandelingen", price_eur: 1000, question: "Wil je het all-in pakket?" }));
  it("consult erbij adds its minutes (20 + 15 = 35)", () => expect(addonMinutes(20, { type: "consult", minutes: 15 })).toBe(35));
  it("finds the treatment-type group and its consult", () => {
    expect(typeGroup(groups, "lichaam")).toBe("ontharing");
    expect(consultFor(m, groups, [{ id: "consult-ontharing", kind: "consult" }, { id: "oksels", kind: "behandeling" }], "lichaam")).toBe("consult-ontharing");
  });
  it("uses the group the patient came through", () => expect(placementParent(m, "oksels", "laser")).toBe("lichaam"));
  it("group names in a sentence", () => {
    expect(groupPhrase("Laserontharing definitief")).toBe("laserontharing");
    expect(groupPhrase("Chemische peeling")).toBe("een chemische peeling");
    expect(groupPhrase("Morpheus8")).toBe("Morpheus8");
    expect(groupPhrase("HIFU")).toBe("HIFU");
    expect(groupPhrase("PlexR")).toBe("PlexR");
  });
});
