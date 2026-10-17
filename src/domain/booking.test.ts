import { describe, expect, it } from "vitest";

import { dayPart, nextStep, sortLocations, type Catalog } from "./booking";

const cat = (over: Partial<Catalog> = {}): Catalog => ({
  categories: [{ id: "A", parent_id: null }, { id: "B", parent_id: null }, { id: "A1", parent_id: "A" }, { id: "A2", parent_id: "A" }],
  links: [{ treatment_id: "t1", category_id: "A1" }, { treatment_id: "t2", category_id: "A2" }, { treatment_id: "t3", category_id: "A2" }, { treatment_id: "t4", category_id: "B" }],
  treatments: [{ id: "t1", practitioner_choice: "optional" }, { id: "t2", practitioner_choice: "required" }, { id: "t3", practitioner_choice: "assigned" }, { id: "t4", practitioner_choice: "fixed" }],
  locationsFor: (t) => (t === "t1" ? ["L1", "L2"] : ["L1"]),
  ...over,
});

describe("nextStep", () => {
  it("starts with categories", () => expect(nextStep(cat(), {})).toEqual({ kind: "category", options: ["A", "B"] }));
  it("subcategories when more than one", () => expect(nextStep(cat(), { cat: "A" }).kind).toBe("subcategory"));
  it("skips a single treatment and a single location", () => {
    expect(nextStep(cat(), { cat: "A", sub: "A1" })).toEqual({ kind: "location", treatment: "t1", options: ["L1", "L2"] });
    expect(nextStep(cat(), { cat: "A", sub: "A2" })).toEqual({ kind: "treatment", category: "A2", options: ["t2", "t3"] });
  });
  it("hides categories without bookable treatments", () => {
    expect(nextStep(cat({ locationsFor: (t) => (t === "t4" ? [] : ["L1"]) }), {})).toEqual({ kind: "subcategory", category: "A", options: ["A1", "A2"] });
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
