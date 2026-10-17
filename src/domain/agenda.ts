/** Day agenda: which schedule segments a practitioner has on a date (per location, with breaks). */
import { blockOn, toMin, type SlotBlock, type SlotException } from "./slots";

export interface Segment { start: number; end: number; locationId: string | null; kind: "work" | "break" }

const inRange = (d: string, from: string, to: string | null) => d >= from && d <= (to ?? from);

export function daySegments(practitionerId: string, date: string, blocks: readonly SlotBlock[], exceptions: readonly SlotException[]): Segment[] {
  const ex = exceptions.filter((e) => e.practitioner_id === practitionerId && inRange(date, e.date_from, e.date_to));
  if (ex.some((e) => e.kind === "vacation" && !e.starts)) return [];
  let work: Segment[] = blocks.filter((b) => b.practitioner_id === practitionerId && blockOn(b, date))
    .map((b) => ({ start: toMin(b.starts), end: toMin(b.ends), locationId: b.location_id, kind: "work" as const }));
  for (const e of ex) if (e.kind === "extra_day" && e.starts && e.ends) work.push({ start: toMin(e.starts), end: toMin(e.ends), locationId: e.location_id ?? null, kind: "work" });
  const breaks: Segment[] = [];
  for (const e of ex) {
    if ((e.kind !== "break" && e.kind !== "vacation") || !e.starts || !e.ends) continue;
    const s = toMin(e.starts), en = toMin(e.ends);
    work = work.flatMap((w) => (en <= w.start || s >= w.end ? [w] : [
      ...(s > w.start ? [{ ...w, end: s }] : []), ...(en < w.end ? [{ ...w, start: en }] : []),
    ]));
    breaks.push({ start: s, end: en, locationId: null, kind: "break" });
  }
  return [...work, ...breaks].sort((a, b) => a.start - b.start);
}

/** Visible hour range for the grid: earliest segment/appointment floored, latest ceiled; default 08–17. */
export function hourRange(minutes: readonly number[]): [number, number] {
  if (!minutes.length) return [8, 17];
  return [Math.min(8, Math.floor(Math.min(...minutes) / 60)), Math.max(17, Math.ceil(Math.max(...minutes) / 60))];
}

/** Free 30-minute places in work segments that no appointment overlaps (week tile "Vrije plekken"). */
export function freePlaces(segments: readonly Segment[], appts: ReadonlyArray<{ start: number; end: number }>, step = 30): number {
  let n = 0;
  for (const g of segments) {
    if (g.kind !== "work") continue;
    for (let t = g.start; t + step <= g.end; t += step) if (!appts.some((a) => a.start < t + step && a.end > t)) n++;
  }
  return n;
}

/** Monday of the ISO week containing `date` (YYYY-MM-DD). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** "Nu bezig" / "Volgende" on Mijn dag: appointment running at `now`, and the first one starting after it. */
export function nowAndNext<T extends { start: number; end: number }>(appts: readonly T[], now: number) {
  const sorted = [...appts].sort((a, b) => a.start - b.start);
  const current = sorted.find((a) => a.start <= now && now < a.end) ?? null;
  const next = sorted.find((a) => a.start > now) ?? null;
  return { current, next, minutesLeft: current ? current.end - now : null, minutesUntil: next ? next.start - now : null };
}
