/**
 * Statistics API: only totals, never a row about one person. Pure aggregation over rows the
 * caller already scoped to one brand, so the same rules serve the dashboard and the public API.
 */

export type CountRow = { source: string | null; referral_source: string | null; booking_link_id: string | null };

/** Source of an arrival: the booking link's source, otherwise the referral the patient gave, otherwise "Website". */
export const arrivalSource = (r: CountRow, linkSources: ReadonlyMap<string, string>): string => {
  const viaLink = r.booking_link_id ? linkSources.get(r.booking_link_id) : undefined;
  if (viaLink?.trim()) return viaLink.trim();
  if (r.referral_source?.trim()) return r.referral_source.trim();
  return "Website";
};

export interface SourceCount {
  source: string;
  count: number;
  share: number;
}

/** Totals per source, biggest first; ties keep alphabetical order so the list is stable. */
export function bySource(rows: readonly CountRow[], linkSources: ReadonlyMap<string, string>): SourceCount[] {
  const total = rows.length;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = arrivalSource(r, linkSources);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, count]) => ({ source, count, share: total ? Math.round((count / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source, "nl"));
}

export interface DayCounts {
  day: string;
  arrivals: number;
  appointments: number;
}

/** Per-day totals for a range, including days without anything (so a chart keeps its shape). */
export function perDay(days: readonly string[], arrivals: ReadonlyArray<{ day: string }>, appointments: ReadonlyArray<{ day: string }>): DayCounts[] {
  const count = (rows: ReadonlyArray<{ day: string }>) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.day, (m.get(r.day) ?? 0) + 1);
    return m;
  };
  const a = count(arrivals);
  const b = count(appointments);
  return days.map((day) => ({ day, arrivals: a.get(day) ?? 0, appointments: b.get(day) ?? 0 }));
}

/** Occupancy of scheduled time, as a whole percentage. */
export const occupancy = (bookedMinutes: number, scheduledMinutes: number) => (scheduledMinutes > 0 ? Math.min(100, Math.round((bookedMinutes / scheduledMinutes) * 100)) : 0);

/** No-show rate as a whole percentage of the appointments that took place or were missed. */
export const noShowRate = (noShows: number, relevant: number) => (relevant > 0 ? Math.round((noShows / relevant) * 100) : 0);
