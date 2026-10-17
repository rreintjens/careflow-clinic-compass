import type { Org } from "@/data/organisation";
import { baseDeviceName, numberNames, type DeviceLite, type Placement } from "@/domain/equipment";

export type Device = Org["equipment"][number];

/** Rooms of a location in display order; number = index + 1. */
export const roomsOf = (org: Org, locationId: string) =>
  org.rooms.filter((r) => r.location_id === locationId).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
export const roomNumber = (org: Org, roomId: string | null) => {
  const room = org.rooms.find((r) => r.id === roomId);
  if (!room) return null;
  return roomsOf(org, room.location_id).findIndex((r) => r.id === roomId) + 1;
};

export const typeOf = (org: Org, typeId: string | null) => org.equipmentTypes.find((t) => t.id === typeId);
export const brandType = (org: Org, typeId: string | null) => {
  const t = typeOf(org, typeId);
  return t ? `${t.brand} ${t.type}`.trim() : "";
};
export const kindOfType = (org: Org, typeId: string | null) => {
  const t = typeOf(org, typeId);
  return org.equipmentKinds.find((k) => k.id === t?.kind_id);
};

function base(org: Org, d: { type_id: string | null; placement: string; location_id: string | null; room_id: string | null }) {
  return baseDeviceName({
    brandType: brandType(org, d.type_id),
    placement: d.placement as Placement,
    locationName: org.locations.find((l) => l.id === d.location_id)?.name ?? "",
    roomNumber: roomNumber(org, d.room_id),
  });
}

/** Generated names of all devices (numbered when the same type is at the same place). */
export function deviceNames(org: Org): Map<string, string> {
  const list = [...org.equipment].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const names = numberNames(list.map((d) => base(org, d)));
  return new Map(list.map((d, i) => [d.id, names[i] ?? ""]));
}

/** Name a device would get when saved now (draft = not yet saved, or edited). */
export function previewName(org: Org, draft: { id: string | null; type_id: string; placement: string; location_id: string | null; room_id: string | null }) {
  const others = org.equipment.filter((d) => d.id !== draft.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const bases = [...others.map((d) => base(org, d)), base(org, draft)];
  return numberNames(bases).at(-1) ?? "";
}

export const deviceLite = (org: Org): DeviceLite[] =>
  org.equipment.map((d) => ({
    id: d.id,
    kind: kindOfType(org, d.type_id)?.key ?? d.kind,
    placement: d.placement as Placement,
    location_id: d.location_id,
    room_id: d.room_id,
    status: d.status,
    next_maintenance_on: d.next_maintenance_on,
    schedule: org.dayLocations.filter((s) => s.equipment_id === d.id),
  }));
