import { describe, expect, it } from "vitest";

import {
  blockWithinOpeningHours,
  durationOptions,
  locationBookability,
  nextOccurrences,
  practitionerTreatmentLocations,
  quarterTimes,
  scheduleStatus,
  type EquipmentLite,
} from "./organisation";

const online = { id: "on", name: "Online", kind: "online" as const };
const az = { id: "az", name: "Amsterdam-Zuid", kind: "clinic" as const };
const dh = { id: "dh", name: "Den Haag", kind: "clinic" as const };
const rooms = [{ id: "r1", location_id: "az" }, { id: "r2", location_id: "dh" }];
const laserFixed: EquipmentLite = { id: "l1", kind: "laser", mobility: "fixed_room", room_id: "r1", location_id: null, day_locations: [] };
const laserReq = [{ kind: "room" as const, equipment_kind: null }, { kind: "equipment" as const, equipment_kind: "laser" }];

describe("practitionerTreatmentLocations", () => {
  it.each([
    [["on", "az", "ab"], ["az", "ab"], [], ["az", "ab"]],
    [["on", "az", "ab"], ["on", "az", "ab"], ["ab"], ["on", "az"]],
    [["az"], ["dh"], [], []],
  ])("work %j offered %j excluded %j -> %j", (work, offered, ex, expected) => {
    expect(practitionerTreatmentLocations(work, offered, ex)).toEqual(expected);
  });
});

describe("locationBookability", () => {
  const base = { requirements: laserReq, offeredLocationIds: ["az", "dh"], rooms, equipment: [laserFixed] };
  it("ok with practitioner, room and fixed laser", () => {
    expect(locationBookability({ ...base, location: az, practitioners: [{ practitioner_id: "p", location_ids: ["az"], excluded_location_ids: [] }] })).toBe("ok");
  });
  it("no practitioner when nobody works there", () => {
    expect(locationBookability({ ...base, location: dh, practitioners: [{ practitioner_id: "p", location_ids: ["az"], excluded_location_ids: [] }] })).toBe("no_practitioner");
  });
  it("no practitioner when excluded at that location", () => {
    expect(locationBookability({ ...base, location: az, practitioners: [{ practitioner_id: "p", location_ids: ["az"], excluded_location_ids: ["az"] }] })).toBe("no_practitioner");
  });
  it("no equipment when the laser is elsewhere", () => {
    expect(locationBookability({ ...base, location: dh, practitioners: [{ practitioner_id: "p", location_ids: ["dh"], excluded_location_ids: [] }] })).toBe("no_equipment");
  });
  it("movable laser within the location counts", () => {
    const movable: EquipmentLite = { id: "l2", kind: "laser", mobility: "movable_location", room_id: null, location_id: "dh", day_locations: [] };
    expect(locationBookability({ ...base, equipment: [movable], location: dh, practitioners: [{ practitioner_id: "p", location_ids: ["dh"], excluded_location_ids: [] }] })).toBe("ok");
  });
  it("online needs no room or equipment", () => {
    expect(locationBookability({ ...base, offeredLocationIds: ["on"], location: online, practitioners: [{ practitioner_id: "p", location_ids: ["on"], excluded_location_ids: [] }] })).toBe("ok");
  });
});

describe("options", () => {
  it("durations are steps of 5 up to 240", () => {
    const d = durationOptions();
    expect(d[0]).toBe(5);
    expect(d.at(-1)).toBe(240);
    expect(d).toHaveLength(48);
  });
  it("times are per quarter", () => {
    expect(quarterTimes(8, 9)).toEqual(["08:00", "08:15", "08:30", "08:45", "09:00"]);
  });
});

describe("blockWithinOpeningHours", () => {
  const hours = [{ location_id: "az", weekday: 4, opens: "08:30", closes: "21:00", closed: false }, { location_id: "az", weekday: 7, opens: null, closes: null, closed: true }];
  it.each([
    [{ weekday: 4, location_id: "az", starts: "09:00", ends: "15:00" }, true],
    [{ weekday: 4, location_id: "az", starts: "08:00", ends: "15:00" }, false],
    [{ weekday: 7, location_id: "az", starts: "10:00", ends: "12:00" }, false],
    [{ weekday: 7, location_id: "on", starts: "10:00", ends: "12:00" }, true],
  ])("%j -> %s", (b, ok) => {
    expect(blockWithinOpeningHours(b, hours, ["on"])).toBe(ok);
  });
});

describe("nextOccurrences", () => {
  it("weekly Tuesday from 19 Oct 2026 (design example)", () => {
    expect(nextOccurrences(2, "weekly", "2026-10-19", null, "2026-10-19")).toEqual(["2026-10-20", "2026-10-27", "2026-11-03"]);
  });
  it("every two weeks", () => {
    expect(nextOccurrences(4, "biweekly", "2026-10-19", null, "2026-10-19")).toEqual(["2026-10-22", "2026-11-05", "2026-11-19"]);
  });
  it("stops at valid until", () => {
    expect(nextOccurrences(1, "weekly", "2026-10-19", "2026-10-26", "2026-10-19", 5)).toEqual(["2026-10-19", "2026-10-26"]);
  });
  it("once happens once", () => {
    expect(nextOccurrences(5, "once", "2026-10-19", null, "2026-10-19", 3)).toEqual(["2026-10-23"]);
  });
});

describe("scheduleStatus", () => {
  it.each([
    [[], { kind: "none" }],
    [[{ valid_until: null }], { kind: "open" }],
    [[{ valid_until: "2026-10-31" }], { kind: "until", date: "2026-10-31" }],
  ])("%j", (blocks, expected) => {
    expect(scheduleStatus(blocks)).toEqual(expected);
  });
});
