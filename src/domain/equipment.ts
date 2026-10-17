/** Pure equipment rules: where a device counts for availability, and its generated name. */

export type Placement = "fixed_room" | "movable_location" | "travelling";

export interface DeviceLite {
  id: string;
  kind: string; // equipment_kinds.key
  placement: Placement;
  location_id: string | null;
  room_id: string | null;
  status: string; // only "in_use" counts
  next_maintenance_on: string | null; // YYYY-MM-DD
  schedule: ReadonlyArray<{ weekday: number; location_id: string | null }>;
}
export interface RoomRef {
  id: string;
  location_id: string;
}

/** ISO weekday 1 (Mon) .. 7 (Sun) of a YYYY-MM-DD date. */
export const weekdayOf = (date: string) => ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;

/** A device counts on a day unless it is out of use or it is its maintenance day. */
export function deviceCountsOn(d: DeviceLite, date: string): boolean {
  return d.status === "in_use" && d.next_maintenance_on !== date;
}

/**
 * Rooms at location L where a treatment needing kind K can take place on date D:
 * a room with a fixed device of K, every room of L when a device of K is movable within L,
 * or every room of L when a travelling device of K is scheduled at L that weekday.
 */
export function roomsForKind(args: {
  kind: string;
  locationId: string;
  date: string;
  rooms: readonly RoomRef[];
  devices: readonly DeviceLite[];
}): string[] {
  const { kind, locationId, date, rooms, devices } = args;
  const here = rooms.filter((r) => r.location_id === locationId);
  const wd = weekdayOf(date);
  const usable = devices.filter((d) => d.kind === kind && deviceCountsOn(d, date));
  const anywhere = usable.some(
    (d) =>
      (d.placement === "movable_location" && d.location_id === locationId) ||
      (d.placement === "travelling" && d.schedule.some((s) => s.weekday === wd && s.location_id === locationId)),
  );
  if (anywhere) return here.map((r) => r.id);
  const fixed = new Set(usable.filter((d) => d.placement === "fixed_room").map((d) => d.room_id));
  return here.filter((r) => fixed.has(r.id)).map((r) => r.id);
}

/** Rooms at L on D that satisfy every required kind (no kinds: every room). */
export function roomsForKinds(args: { kinds: readonly string[]; locationId: string; date: string; rooms: readonly RoomRef[]; devices: readonly DeviceLite[] }): string[] {
  let ids = args.rooms.filter((r) => r.location_id === args.locationId).map((r) => r.id);
  for (const kind of args.kinds) {
    const ok = new Set(roomsForKind({ ...args, kind }));
    ids = ids.filter((id) => ok.has(id));
  }
  return ids;
}

/** Base name of a device from its type and placement. */
export function baseDeviceName(args: { brandType: string; placement: Placement; locationName: string; roomNumber: number | null }): string {
  const { brandType, placement, locationName, roomNumber } = args;
  if (placement === "fixed_room") return `${brandType}, ${locationName} kamer ${roomNumber ?? ""}`.trim();
  if (placement === "movable_location") return `${brandType}, ${locationName}, verplaatsbaar`;
  return `${brandType}, reizend`;
}

/** Appends " 2", " 3"… when the same base name occurs more than once (order = given order). */
export function numberNames(bases: readonly string[]): string[] {
  const total = new Map<string, number>();
  for (const b of bases) total.set(b, (total.get(b) ?? 0) + 1);
  const seen = new Map<string, number>();
  return bases.map((b) => {
    const n = (seen.get(b) ?? 0) + 1;
    seen.set(b, n);
    return (total.get(b) ?? 0) > 1 && n > 1 ? `${b} ${n}` : b;
  });
}

/** YYYY-MM-DD plus whole months (clamped to month end). */
export function addMonths(date: string, months: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

/** Why a kind cannot be deleted, or null when nothing references it. */
export function kindDeleteBlocker(usage: { treatments: number; devices: number; children: number }): string | null {
  const parts: string[] = [];
  if (usage.treatments) parts.push(`${usage.treatments} ${usage.treatments === 1 ? "behandeling vereist" : "behandelingen vereisen"} deze soort`);
  if (usage.devices) parts.push(`${usage.devices} ${usage.devices === 1 ? "apparaat heeft" : "apparaten hebben"} deze soort`);
  if (usage.children) parts.push(`${usage.children} ${usage.children === 1 ? "soort hoort" : "soorten horen"} erbij`);
  return parts.length ? `Verwijderen kan niet: ${parts.join(", ")}.` : null;
}
