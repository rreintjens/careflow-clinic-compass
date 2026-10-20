import { expect, it } from "vitest";
import { appointmentResources } from "./appointment-resources";
const args = { locationId: "clinic", date: "2026-10-21", kinds: [], rooms: [{ id: "one", location_id: "clinic" }, { id: "two", location_id: "clinic" }], devices: [], busy: [] };
it("automatically assigns a free room", () => expect(appointmentResources(args).roomId).toBe("one"));
it("never assigns an occupied room", () => expect(appointmentResources({ ...args, busy: [{ room_id: "one", equipment_ids: [] }] }).roomId).toBe("two"));
it("rejects unavailable required equipment", () => expect(appointmentResources({ ...args, kinds: ["laser"] }).roomId).toBeNull());
it("uses a different room when the first room's fixed device is busy", () => {
  const devices = ["one", "two"].map(room => ({id:`laser-${room}`,kind:"laser",placement:"fixed_room" as const,location_id:"clinic",room_id:room,status:"in_use",next_maintenance_on:null,schedule:[]}));
  expect(appointmentResources({...args,kinds:["laser"],devices,busy:[{room_id:null,equipment_ids:["laser-one"]}]})).toEqual({roomId:"two",equipmentIds:["laser-two"]});
});