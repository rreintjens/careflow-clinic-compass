import { describe, expect, it } from "vitest";
import { insertBeforeLast, rowChange } from "./diff";
import type { QuestionnaireDef } from "./engine";

const live: QuestionnaireDef = { id: "q", name: "Q", moment: "before_booking", pages: [
  { id: "intro", type: "text", title: "Hallo" },
  { id: "p1", items: [{ id: "a", type: "number", text: "Gewicht?" }] },
  { id: "end", type: "text", title: "Klaar" },
] };

describe("concept row labels", () => {
  it("marks a question that is not live as Nieuw", () => expect(rowChange(live, { id: "p2", items: [{ id: "b", type: "yes_no", text: "Ja?" }] }, { id: "b" })).toBe("new"));
  it("marks an edited question as Gewijzigd", () => expect(rowChange(live, { id: "p1", items: [{ id: "a", type: "number", text: "Je gewicht?" }] }, { id: "a" })).toBe("changed"));
  it("leaves unchanged rows unlabelled", () => expect(rowChange(live, live.pages[0]!)).toBeNull());
  it("labels nothing without a live version", () => expect(rowChange(null, live.pages[0]!)).toBeNull());
});

describe("adding from the compact list", () => {
  it("inserts before the final page", () => {
    const r = insertBeforeLast(live.pages, { id: "new" });
    expect(r.index).toBe(2);
    expect(r.pages.map((p) => p.id)).toEqual(["intro", "p1", "new", "end"]);
  });
  it("appends to an empty questionnaire", () => expect(insertBeforeLast([], { id: "x" }).index).toBe(0));
});
