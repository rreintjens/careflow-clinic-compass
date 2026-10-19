import { describe, expect, it } from "vitest";

import { fmtTime, freeSlots, holdActive, holdExpiresAt, mergeByTime, secondsLeft, type SlotBlock, type SlotException } from "./slots";

// 2026-10-20 is a Tuesday (weekday 2).
const block: SlotBlock = { practitioner_id: "p1", weekday: 2, location_id: "L", starts: "09:00", ends: "11:00", recurrence: "weekly", valid_from: "2026-01-01", valid_until: null, treatment_ids: null };
const base = { date: "2026-10-20", locationId: "L", treatmentId: "T", durationMin: 30, practitionerIds: ["p1"], blocks: [block], exceptions: [] as SlotException[], busy: [], now: { date: "2026-10-19", minute: 600 }, leadMinutes: 120, maxAheadWeeks: 8 };
const times = (s: ReturnType<typeof freeSlots>) => s.map((x) => fmtTime(x.start));

describe("freeSlots", () => {
  it("every 15 minutes where the treatment fits", () => {
    expect(times(freeSlots(base))).toEqual(["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30"]);
  });
  it("skips times overlapping a held or booked appointment", () => {
    expect(times(freeSlots({ ...base, busy: [{ practitioner_id: "p1", date: "2026-10-20", start: 570, end: 600 }] }))).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });
  it("respects the minimum lead time on the same day", () => {
    expect(times(freeSlots({ ...base, now: { date: "2026-10-20", minute: 450 } }))).toEqual(["09:30", "09:45", "10:00", "10:15", "10:30"]);
  });
  it("nothing in the past or beyond max weeks ahead", () => {
    expect(freeSlots({ ...base, now: { date: "2026-10-21", minute: 0 } })).toEqual([]);
    expect(freeSlots({ ...base, now: { date: "2026-08-01", minute: 0 } })).toEqual([]);
  });
  it("a whole-day vacation removes the day", () => {
    expect(freeSlots({ ...base, exceptions: [{ practitioner_id: "p1", kind: "vacation", date_from: "2026-10-19", date_to: "2026-10-23", starts: null, ends: null, location_id: null }] })).toEqual([]);
  });
  it("a break cuts a hole", () => {
    expect(times(freeSlots({ ...base, exceptions: [{ practitioner_id: "p1", kind: "break", date_from: "2026-10-20", date_to: null, starts: "10:00", ends: "10:30", location_id: null }] }))).toEqual(["09:00", "09:15", "09:30", "10:30"]);
  });
  it("blocks limited to other treatments give nothing", () => {
    expect(freeSlots({ ...base, blocks: [{ ...block, treatment_ids: ["X"] }] })).toEqual([]);
  });
  it("biweekly block skips the off week", () => {
    expect(freeSlots({ ...base, blocks: [{ ...block, recurrence: "biweekly", valid_from: "2026-10-13" }] })).toEqual([]);
  });
});

describe("mergeByTime", () => {
  it("no preference: practitioner with fewest appointments gets the time", () => {
    const s = [{ practitioner_id: "a", date: "d", start: 540 }, { practitioner_id: "b", date: "d", start: 540 }];
    expect(mergeByTime(s, (p) => (p === "a" ? 3 : 1))).toEqual([{ practitioner_id: "b", date: "d", start: 540 }]);
  });
});

describe("hold", () => {
  it("15 minute hold expires", () => {
    const exp = holdExpiresAt(0, 15);
    expect(exp).toBe(900_000);
    expect(holdActive("held", exp, 899_999)).toBe(true);
    expect(holdActive("held", exp, 900_000)).toBe(false);
    expect(holdActive("booked", null, 10 ** 12)).toBe(true);
    expect(secondsLeft(exp, 840_000)).toBe(60);
  });
});

describe("mixed online and clinic time", () => {
  const onlineLocationIds = ["Online"];
  const all = ["09:00", "09:15", "09:30", "09:45", "10:00", "10:15", "10:30"];
  it.each([
    { rule: "online consult inside enabled clinic block", locationId: "Online", blockLocation: "L", allows_online: true, expected: all },
    { rule: "no online consult inside disabled clinic block", locationId: "Online", blockLocation: "L", allows_online: false, expected: [] },
    { rule: "clinic booking never uses online-only block", locationId: "L", blockLocation: "Online", allows_online: true, expected: [] },
    { rule: "online-only ignores the flag", locationId: "Online", blockLocation: "Online", allows_online: false, expected: all },
  ])("$rule", ({ locationId, blockLocation, allows_online, expected }) => {
    expect(times(freeSlots({ ...base, locationId, onlineLocationIds, blocks: [{ ...block, location_id: blockLocation, allows_online }] }))).toEqual(expected);
  });
  it.each([
    { booking: "L", occupied: "Online" },
    { booking: "Online", occupied: "L" },
  ])("$occupied appointment blocks $booking booking for the same doctor", ({ booking, occupied }) => {
    const appointments = [{ practitioner_id: "p1", location_id: occupied, date: base.date, start: 570, end: 600 }];
    expect(times(freeSlots({ ...base, locationId: booking, onlineLocationIds, busy: appointments }))).toEqual(["09:00", "10:00", "10:15", "10:30"]);
  });
  it.each([
    { rule: "treatment scope", blocks: [{ ...block, treatment_ids: ["X"] }], exceptions: [], expected: [] },
    { rule: "recurrence", blocks: [{ ...block, recurrence: "biweekly" as const, valid_from: "2026-10-13" }], exceptions: [], expected: [] },
    { rule: "vacation", blocks: [block], exceptions: [{ practitioner_id: "p1", kind: "vacation" as const, date_from: base.date, date_to: null, starts: null, ends: null, location_id: null }], expected: [] },
    { rule: "break", blocks: [block], exceptions: [{ practitioner_id: "p1", kind: "break" as const, date_from: base.date, date_to: null, starts: "10:00", ends: "10:30", location_id: null }], expected: ["09:00", "09:15", "09:30", "10:30"] },
    { rule: "no duplicate online times", blocks: [block, { ...block, location_id: "Online" }], exceptions: [], expected: all },
  ])("mixed online availability respects $rule", ({ blocks, exceptions, expected }) => {
    expect(times(freeSlots({ ...base, locationId: "Online", onlineLocationIds, blocks, exceptions }))).toEqual(expected);
  });
  it("no preference counts both online and clinic appointments", () => {
    const slots = freeSlots({ ...base, locationId: "Online", onlineLocationIds, practitionerIds: ["p1", "p2"], blocks: [block, { ...block, practitioner_id: "p2", location_id: "Online" }] });
    const appointments = [{ practitioner_id: "p1", location_id: "L" }, { practitioner_id: "p1", location_id: "Online" }, { practitioner_id: "p2", location_id: "Online" }];
    expect(mergeByTime(slots, (p) => appointments.filter((a) => a.practitioner_id === p).length).map((s) => s.practitioner_id)).toEqual(Array(7).fill("p2"));
  });
});
