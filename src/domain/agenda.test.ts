import { describe, expect, it } from "vitest";

import { daySegments, hourRange } from "./agenda";
import type { SlotBlock, SlotException } from "./slots";

const P = "p1";
const block = (weekday: number, starts: string, ends: string, loc = "L1"): SlotBlock => ({ practitioner_id: P, weekday, location_id: loc, starts, ends, recurrence: "weekly", valid_from: "2026-01-01", valid_until: null, treatment_ids: null });
const ex = (e: Partial<SlotException>): SlotException => ({ practitioner_id: P, kind: "break", date_from: "2026-10-20", date_to: null, starts: null, ends: null, location_id: null, ...e });
const TUE = "2026-10-20";

describe("daySegments", () => {
  it("weekly block on its weekday", () => expect(daySegments(P, TUE, [block(2, "09:00", "17:00")], [])).toEqual([{ start: 540, end: 1020, locationId: "L1", kind: "work" }]));
  it("not on another weekday", () => expect(daySegments(P, TUE, [block(3, "09:00", "17:00")], [])).toEqual([]));
  it("full-day vacation clears the day", () => expect(daySegments(P, TUE, [block(2, "09:00", "17:00")], [ex({ kind: "vacation" })])).toEqual([]));
  it("break splits the block and shows as pause", () => expect(daySegments(P, TUE, [block(2, "09:00", "17:00")], [ex({ starts: "12:30", ends: "13:30" })]).map((s) => [s.start, s.end, s.kind])).toEqual([[540, 750, "work"], [750, 810, "break"], [810, 1020, "work"]]));
  it("two locations in one day", () => expect(daySegments(P, TUE, [block(2, "13:00", "17:00", "L2"), block(2, "08:30", "12:30")], []).map((s) => s.locationId)).toEqual(["L1", "L2"]));
});

describe("hourRange", () => {
  it.each([[[], [8, 17]], [[540, 1020], [8, 17]], [[450, 1230], [7, 21]]] as const)("%j → %j", (m, r) => expect(hourRange(m)).toEqual(r));
});
