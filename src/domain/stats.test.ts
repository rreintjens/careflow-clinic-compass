import { describe, expect, it } from "vitest";

import { arrivalSource, bySource, noShowRate, occupancy, perDay, type CountRow } from "./stats";

const row = (over: Partial<CountRow> = {}): CountRow => ({ source: null, referral_source: null, booking_link_id: null, ...over });
const links = new Map([["l1", "Instagram oktober"], ["l2", "  "]]);

describe("arrivalSource", () => {
  it("prefers the source of the booking link", () => {
    expect(arrivalSource(row({ booking_link_id: "l1", referral_source: "huisarts" }), links)).toBe("Instagram oktober");
  });
  it("falls back to what the patient said, then to Website", () => {
    expect(arrivalSource(row({ referral_source: "huisarts" }), links)).toBe("huisarts");
    expect(arrivalSource(row(), links)).toBe("Website");
    expect(arrivalSource(row({ booking_link_id: "l2" }), links)).toBe("Website"); // blank source on the link
    expect(arrivalSource(row({ booking_link_id: "unknown" }), links)).toBe("Website");
  });
});

describe("bySource", () => {
  it("totals, shares and a stable order", () => {
    const rows = [row({ booking_link_id: "l1" }), row({ booking_link_id: "l1" }), row({ booking_link_id: "l1" }), row(), row({ referral_source: "Google" })];
    expect(bySource(rows, links)).toEqual([
      { source: "Instagram oktober", count: 3, share: 60 },
      { source: "Website", count: 1, share: 20 },
      { source: "Google", count: 1, share: 20 },
    ]);
  });
  it("an empty range has no sources and no division", () => {
    expect(bySource([], links)).toEqual([]);
  });
});

it("perDay keeps empty days", () => {
  expect(perDay(["2026-10-17", "2026-10-18", "2026-10-19"], [{ day: "2026-10-18" }, { day: "2026-10-18" }], [{ day: "2026-10-17" }])).toEqual([
    { day: "2026-10-17", arrivals: 0, appointments: 1 },
    { day: "2026-10-18", arrivals: 2, appointments: 0 },
    { day: "2026-10-19", arrivals: 0, appointments: 0 },
  ]);
});

it("occupancy and no-show rate are whole percentages and never divide by zero", () => {
  expect(occupancy(50, 200)).toBe(25);
  expect(occupancy(300, 200)).toBe(100);
  expect(occupancy(0, 0)).toBe(0);
  expect(noShowRate(3, 150)).toBe(2);
  expect(noShowRate(0, 0)).toBe(0);
});
