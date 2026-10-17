import { describe, expect, it } from "vitest";

import { addMonths, baseDeviceName, numberNames, roomsForKind, roomsForKinds, type DeviceLite } from "./equipment";

// 2027-03-08 is a Monday, 2027-03-10 a Wednesday.
const MON = "2027-03-08";
const WED = "2027-03-10";
const rooms = [
  { id: "az1", location_id: "az" },
  { id: "az2", location_id: "az" },
  { id: "az3", location_id: "az" },
  { id: "dh1", location_id: "dh" },
  { id: "dh2", location_id: "dh" },
];
const dev = (p: Partial<DeviceLite>): DeviceLite => ({
  id: "d", kind: "laser", placement: "fixed_room", location_id: "az", room_id: "az1", status: "in_use", next_maintenance_on: null, schedule: [], ...p,
});

describe("roomsForKind", () => {
  it.each<[string, DeviceLite[], string, string, string[]]>([
    ["fixed device: only its room", [dev({})], "az", MON, ["az1"]],
    ["fixed device elsewhere: nothing", [dev({})], "dh", MON, []],
    ["movable within location: every room there", [dev({ placement: "movable_location", room_id: null })], "az", MON, ["az1", "az2", "az3"]],
    ["movable within other location: nothing", [dev({ placement: "movable_location", room_id: null, location_id: "dh" })], "az", MON, []],
    ["travelling, scheduled here today", [dev({ placement: "travelling", location_id: null, room_id: null, schedule: [{ weekday: 1, location_id: "dh" }] })], "dh", MON, ["dh1", "dh2"]],
    ["travelling, scheduled elsewhere today", [dev({ placement: "travelling", location_id: null, room_id: null, schedule: [{ weekday: 1, location_id: "dh" }, { weekday: 3, location_id: "az" }] })], "dh", WED, []],
    ["fixed, maintenance day: nothing", [dev({ next_maintenance_on: MON })], "az", MON, []],
    ["fixed, day after maintenance: room back", [dev({ next_maintenance_on: MON })], "az", "2027-03-09", ["az1"]],
    ["movable, maintenance day: nothing", [dev({ placement: "movable_location", room_id: null, next_maintenance_on: MON })], "az", MON, []],
    ["out of service never counts", [dev({ status: "out_of_service" })], "az", MON, []],
    ["other kind does not count", [dev({ kind: "hifu" })], "az", MON, []],
    ["one in maintenance, other fixed still counts", [dev({ id: "a", next_maintenance_on: MON }), dev({ id: "b", room_id: "az2" })], "az", MON, ["az2"]],
  ])("%s", (_n, devices, loc, date, expected) => {
    expect(roomsForKind({ kind: "laser", locationId: loc, date, rooms, devices })).toEqual(expected);
  });
});

describe("roomsForKinds", () => {
  it("needs every kind in the same room", () => {
    const devices = [dev({}), dev({ id: "s", kind: "smoke", room_id: "az1" }), dev({ id: "l2", room_id: "az2" })];
    expect(roomsForKinds({ kinds: ["laser", "smoke"], locationId: "az", date: MON, rooms, devices })).toEqual(["az1"]);
  });
  it("no kinds: every room", () => {
    expect(roomsForKinds({ kinds: [], locationId: "dh", date: MON, rooms, devices: [] })).toEqual(["dh1", "dh2"]);
  });
});

describe("device names", () => {
  it.each([
    ["fixed_room" as const, "Amsterdam-Zuid", 1, "Candela GentleMax Pro, Amsterdam-Zuid kamer 1"],
    ["movable_location" as const, "Amsterdam-Zuid", null, "Candela GentleMax Pro, Amsterdam-Zuid, verplaatsbaar"],
    ["travelling" as const, "", null, "Candela GentleMax Pro, reizend"],
  ])("%s", (placement, locationName, roomNumber, expected) => {
    expect(baseDeviceName({ brandType: "Candela GentleMax Pro", placement, locationName, roomNumber })).toBe(expected);
  });
  it("numbers duplicates", () => {
    expect(numberNames(["A, reizend", "B, reizend", "A, reizend"])).toEqual(["A, reizend", "B, reizend", "A, reizend 2"]);
  });
  it("addMonths clamps", () => {
    expect(addMonths("2026-09-12", 6)).toBe("2027-03-12");
    expect(addMonths("2026-08-31", 6)).toBe("2027-02-28");
  });
});
