/** Bookable time slots and slot holds. All times are local clinic time (date YYYY-MM-DD, minutes since midnight). */
import { isoWeekday, nextOccurrences, type Recurrence } from "./organisation";

export interface SlotBlock {
  practitioner_id: string;
  weekday: number;
  location_id: string;
  starts: string;
  ends: string;
  recurrence: Recurrence;
  valid_from: string;
  valid_until: string | null;
  treatment_ids: string[] | null;
}
export interface SlotException {
  practitioner_id: string;
  kind: "vacation" | "break" | "extra_day";
  date_from: string;
  date_to: string | null;
  starts: string | null;
  ends: string | null;
  location_id: string | null;
}
export interface Busy { practitioner_id: string; date: string; start: number; end: number }
export interface Slot { practitioner_id: string; date: string; start: number }

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
export const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const inRange = (d: string, from: string, to: string | null) => d >= from && d <= (to ?? from);

/** Does a recurring block happen on this date? */
export function blockOn(b: SlotBlock, date: string): boolean {
  if (isoWeekday(new Date(`${date}T00:00:00Z`)) !== b.weekday) return false;
  return nextOccurrences(b.weekday, b.recurrence, b.valid_from, b.valid_until, date, 1)[0] === date;
}

/** Working intervals of one practitioner at one location on a date, after exceptions. */
export function workIntervals(args: { practitionerId: string; locationId: string; treatmentId: string; date: string; blocks: readonly SlotBlock[]; exceptions: readonly SlotException[] }): Array<[number, number]> {
  const { practitionerId: p, locationId, treatmentId, date } = args;
  const ex = args.exceptions.filter((e) => e.practitioner_id === p && inRange(date, e.date_from, e.date_to));
  const vacation = ex.find((e) => e.kind === "vacation");
  if (vacation && !vacation.starts) return [];
  let iv: Array<[number, number]> = args.blocks
    .filter((b) => b.practitioner_id === p && b.location_id === locationId && (!b.treatment_ids?.length || b.treatment_ids.includes(treatmentId)) && blockOn(b, date))
    .map((b) => [toMin(b.starts), toMin(b.ends)]);
  for (const e of ex) if (e.kind === "extra_day" && (!e.location_id || e.location_id === locationId) && e.starts && e.ends) iv.push([toMin(e.starts), toMin(e.ends)]);
  for (const e of ex) if ((e.kind === "break" || e.kind === "vacation") && e.starts && e.ends) iv = subtract(iv, toMin(e.starts), toMin(e.ends));
  return iv;
}

function subtract(iv: Array<[number, number]>, s: number, e: number): Array<[number, number]> {
  return iv.flatMap(([a, b]): Array<[number, number]> => (e <= a || s >= b ? [[a, b]] : [...(s > a ? [[a, s] as [number, number]] : []), ...(e < b ? [[e, b] as [number, number]] : [])]));
}

/**
 * Free start times on a date: every 15 minutes inside a work interval where the whole
 * treatment fits, no overlap with held/booked appointments, and not earlier than now + lead time.
 */
export function freeSlots(args: {
  date: string; locationId: string; treatmentId: string; durationMin: number; practitionerIds: readonly string[];
  blocks: readonly SlotBlock[]; exceptions: readonly SlotException[]; busy: readonly Busy[];
  now: { date: string; minute: number }; leadMinutes: number; maxAheadWeeks: number; step?: number;
}): Slot[] {
  const step = args.step ?? 15;
  const last = new Date(`${args.now.date}T00:00:00Z`);
  last.setUTCDate(last.getUTCDate() + args.maxAheadWeeks * 7);
  if (args.date < args.now.date || args.date > last.toISOString().slice(0, 10)) return [];
  const earliest = args.date === args.now.date ? args.now.minute + args.leadMinutes : -Infinity;
  const out: Slot[] = [];
  for (const p of args.practitionerIds) {
    const busy = args.busy.filter((b) => b.practitioner_id === p && b.date === args.date);
    for (const [a, b] of workIntervals({ practitionerId: p, locationId: args.locationId, treatmentId: args.treatmentId, date: args.date, blocks: args.blocks, exceptions: args.exceptions })) {
      for (let s = Math.ceil(a / step) * step; s + args.durationMin <= b; s += step) {
        if (s < earliest) continue;
        if (busy.some((x) => s < x.end && x.start < s + args.durationMin)) continue;
        out.push({ practitioner_id: p, date: args.date, start: s });
      }
    }
  }
  return out.sort((x, y) => x.start - y.start || x.practitioner_id.localeCompare(y.practitioner_id));
}

/** One time per start (for "no preference"): the practitioner with the fewest appointments that day wins. */
export function mergeByTime(slots: readonly Slot[], countOf: (practitionerId: string) => number): Slot[] {
  const byStart = new Map<number, Slot>();
  for (const s of slots) {
    const cur = byStart.get(s.start);
    if (!cur || countOf(s.practitioner_id) < countOf(cur.practitioner_id)) byStart.set(s.start, s);
  }
  return [...byStart.values()].sort((a, b) => a.start - b.start);
}

/** A hold blocks the slot until it expires; afterwards the patient sees "Je tijd is verlopen". */
export const holdExpiresAt = (nowMs: number, holdMinutes: number) => nowMs + holdMinutes * 60_000;
export const holdActive = (status: string, expiresAtMs: number | null, nowMs: number) => status === "booked" || (status === "held" && expiresAtMs !== null && expiresAtMs > nowMs);
export const secondsLeft = (expiresAtMs: number, nowMs: number) => Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
