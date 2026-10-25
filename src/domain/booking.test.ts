import { describe, expect, it } from "vitest";

import { dayPart, nextStep, sortLocations, type Catalog } from "./booking";

// Top: A (A1: t1 | A2: t2, t3), B (t4), plus t5 directly in the top level.
const cat = (over: Partial<Catalog> = {}): Catalog => ({
  menu: {
    groups: [{ id: "A", parent_id: null, sort: 0 }, { id: "B", parent_id: null, sort: 2 }, { id: "A1", parent_id: "A", sort: 0 }, { id: "A2", parent_id: "A", sort: 1 }],
    links: [{ treatment_id: "t1", category_id: "A1", sort: 0 }, { treatment_id: "t2", category_id: "A2", sort: 0 }, { treatment_id: "t3", category_id: "A2", sort: 1 }, { treatment_id: "t4", category_id: "B", sort: 0 }, { treatment_id: "t6", category_id: "B", sort: 1 }],
    roots: [{ treatment_id: "t5", sort: 1 }],
  },
  treatments: ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) => ({ id, practitioner_choice: { t1: "optional", t2: "required", t3: "assigned", t4: "fixed" }[id] ?? "optional" })),
  locationsFor: (t) => (t === "t1" ? ["L1", "L2"] : ["L1"]),
  ...over,
});

describe("nextStep", () => {
  it("top level mixes groups and treatments in tree order", () =>
    expect(nextStep(cat(), {})).toEqual({ kind: "menu", group: null, items: [{ kind: "group", id: "A" }, { kind: "treatment", id: "t5" }, { kind: "group", id: "B" }] }));
  it("a group with one visible item shows that item directly", () => {
    expect(nextStep(cat(), { cat: "A" })).toEqual({ kind: "menu", group: "A", items: [{ kind: "treatment", id: "t1" }, { kind: "group", id: "A2" }] });
    expect(nextStep(cat(), { cat: "A2" })).toEqual({ kind: "menu", group: "A2", items: [{ kind: "treatment", id: "t2" }, { kind: "treatment", id: "t3" }] });
  });
  it("hides groups without bookable treatments and skips a single remaining choice", () => {
    expect(nextStep(cat({ locationsFor: (t) => (t === "t1" ? ["L1", "L2"] : []) }), {})).toEqual({ kind: "location", treatment: "t1", options: ["L1", "L2"] });
  });
  it("optional: planner with no preference, practitioner list on request", () => {
    expect(nextStep(cat(), { t: "t1", l: "L1" })).toMatchObject({ kind: "planner", practitioner: null, canChoose: true });
    expect(nextStep(cat(), { t: "t1", l: "L1", stap: "wie" })).toMatchObject({ kind: "practitioner", required: false });
  });
  it("required: must choose first", () => {
    expect(nextStep(cat(), { t: "t2", l: "L1" })).toMatchObject({ kind: "practitioner", required: true });
    expect(nextStep(cat(), { t: "t2", l: "L1", p: "any" })).toMatchObject({ kind: "practitioner", required: true });
    expect(nextStep(cat(), { t: "t2", l: "L1", p: "x" })).toMatchObject({ kind: "planner", practitioner: "x" });
  });
  it("assigned: no choice; fixed: only with a practitioner from the link", () => {
    expect(nextStep(cat(), { t: "t3" })).toMatchObject({ kind: "planner", practitioner: null, canChoose: false });
    expect(nextStep(cat(), { t: "t4" })).toEqual({ kind: "none" });
    expect(nextStep(cat(), { t: "t4", p: "x" })).toMatchObject({ kind: "planner", practitioner: "x", canChoose: false });
  });
});

it("Online first", () => {
  expect(sortLocations([{ kind: "clinic", sort: 0, n: 1 }, { kind: "online", sort: 5, n: 2 }]).map((x) => x.n)).toEqual([2, 1]);
});
it("day parts", () => expect([dayPart(719), dayPart(720), dayPart(1019), dayPart(1020)]).toEqual(["morning", "afternoon", "afternoon", "evening"]));
