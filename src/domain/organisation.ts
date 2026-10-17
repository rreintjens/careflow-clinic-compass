/** Pure organisation rules: bookability, schedule checks, option generators. */

export type Mobility = "fixed_room" | "within_location" | "between_locations";

export interface LocationLite {
  id: string;
  name: string;
  kind: "online" | "clinic";
}
export interface RoomLite {
  id: string;
  location_id: string;
}
export interface EquipmentLite {
  id: string;
  kind: string;
  mobility: Mobility;
  room_id: string | null;
  location_id: string | null;
  day_locations: Array<{ weekday: number; location_id: string | null }>;
}
export interface RequirementLite {
  kind: "room" | "equipment";
  equipment_kind: string | null;
}
export interface PractitionerTreatmentLite {
  practitioner_id: string;
  location_ids: string[]; // work locations of the practitioner
  excluded_location_ids: string[];
}

/** Locations where a practitioner actually does a treatment. */
export function practitionerTreatmentLocations(
  workLocationIds: readonly string[],
  offeredLocationIds: readonly string[],
  excluded: readonly string[],
): string[] {
  const offered = new Set(offeredLocationIds);
  const ex = new Set(excluded);
  return workLocationIds.filter((id) => offered.has(id) && !ex.has(id));
}

/** Offered locations where the practitioner works but does not do the treatment. */
export function practitionerExcludedHere(
  workLocationIds: readonly string[],
  offeredLocationIds: readonly string[],
  excluded: readonly string[],
): string[] {
  const offered = new Set(offeredLocationIds);
  return workLocationIds.filter((id) => offered.has(id) && excluded.includes(id));
}

/** Whether a piece of equipment can ever be at a location. */
export function equipmentAvailableAt(e: EquipmentLite, locationId: string, rooms: readonly RoomLite[]): boolean {
  if (e.mobility === "fixed_room") return rooms.some((r) => r.id === e.room_id && r.location_id === locationId);
  if (e.mobility === "within_location") return e.location_id === locationId;
  return e.day_locations.some((d) => d.location_id === locationId);
}

export type BookabilityReason = "ok" | "no_practitioner" | "no_room" | "no_equipment";

/**
 * Bookable = offered, a practitioner who does it there, and the required room and
 * equipment present. The schedule then decides the free times.
 */
export function locationBookability(args: {
  location: LocationLite;
  requirements: readonly RequirementLite[];
  practitioners: readonly PractitionerTreatmentLite[];
  offeredLocationIds: readonly string[];
  rooms: readonly RoomLite[];
  equipment: readonly EquipmentLite[];
}): BookabilityReason {
  const { location, requirements, practitioners, offeredLocationIds, rooms, equipment } = args;
  const hasPractitioner = practitioners.some((p) =>
    practitionerTreatmentLocations(p.location_ids, offeredLocationIds, p.excluded_location_ids).includes(location.id),
  );
  if (!hasPractitioner) return "no_practitioner";
  if (location.kind === "online") return "ok";
  if (requirements.some((r) => r.kind === "room") && !rooms.some((r) => r.location_id === location.id)) return "no_room";
  for (const r of requirements) {
    if (r.kind !== "equipment") continue;
    if (!equipment.some((e) => e.kind === r.equipment_kind && equipmentAvailableAt(e, location.id, rooms))) return "no_equipment";
  }
  return "ok";
}

/** Duration choices: steps of 5 minutes, 5 to 240. */
export function durationOptions(max = 240): number[] {
  return Array.from({ length: max / 5 }, (_, i) => (i + 1) * 5);
}

/** Quarter-hour time choices between two hours (inclusive). */
export function quarterTimes(fromHour = 7, toHour = 22): string[] {
  const out: string[] = [];
  for (let h = fromHour; h <= toHour; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === toHour && m > 0) break;
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return out;
}

export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export interface BlockLite {
  weekday: number;
  location_id: string;
  starts: string;
  ends: string;
}
export interface HoursLite {
  location_id: string;
  weekday: number;
  opens: string | null;
  closes: string | null;
  closed: boolean;
}

/** A clinic block must fall within that location's opening hours. Online has no hours check. */
export function blockWithinOpeningHours(b: BlockLite, hours: readonly HoursLite[], onlineIds: readonly string[]): boolean {
  if (onlineIds.includes(b.location_id)) return true;
  const h = hours.find((x) => x.location_id === b.location_id && x.weekday === b.weekday);
  if (!h || h.closed || !h.opens || !h.closes) return false;
  return toMin(b.starts) >= toMin(h.opens) && toMin(b.ends) <= toMin(h.closes);
}

export function blocksOverlap(a: BlockLite, b: BlockLite): boolean {
  return a.weekday === b.weekday && toMin(a.starts) < toMin(b.ends) && toMin(b.starts) < toMin(a.ends);
}

export type Recurrence = "weekly" | "biweekly" | "monthly" | "once";

/** ISO weekday 1 (Mon) .. 7 (Sun) of a UTC date. */
export const isoWeekday = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

/** Next `count` dates (YYYY-MM-DD) a recurring block happens, on or after `from`. */
export function nextOccurrences(
  weekday: number,
  recurrence: Recurrence,
  validFrom: string,
  validUntil: string | null,
  from: string,
  count = 3,
): string[] {
  const start = new Date(`${validFrom}T00:00:00Z`);
  while (isoWeekday(start) !== weekday) start.setUTCDate(start.getUTCDate() + 1);
  const fromD = new Date(`${from}T00:00:00Z`);
  const until = validUntil ? new Date(`${validUntil}T00:00:00Z`) : null;
  const out: string[] = [];
  const d = new Date(start);
  let i = 0;
  while (out.length < count && i < 500) {
    i++;
    if (until && d > until) break;
    if (d >= fromD) out.push(d.toISOString().slice(0, 10));
    if (recurrence === "once") break;
    if (recurrence === "weekly") d.setUTCDate(d.getUTCDate() + 7);
    else if (recurrence === "biweekly") d.setUTCDate(d.getUTCDate() + 14);
    else {
      // Monthly: same nth weekday of the next month.
      const nth = Math.floor((start.getUTCDate() - 1) / 7);
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      while (isoWeekday(m) !== weekday) m.setUTCDate(m.getUTCDate() + 1);
      m.setUTCDate(m.getUTCDate() + nth * 7);
      d.setTime(m.getTime());
    }
  }
  return out;
}

/** Schedule status for the practitioner list. */
export function scheduleStatus(
  blocks: ReadonlyArray<{ valid_until: string | null }>,
): { kind: "open" } | { kind: "none" } | { kind: "until"; date: string } {
  if (blocks.length === 0) return { kind: "none" };
  if (blocks.some((b) => b.valid_until === null)) return { kind: "open" };
  const last = blocks.map((b) => b.valid_until as string).sort().at(-1) as string;
  return { kind: "until", date: last };
}
