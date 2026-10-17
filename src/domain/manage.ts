/** Rules for a patient changing their own appointment via the manage link. */

/** Rescheduling and cancelling online is allowed until `hours` before the start. */
export function canChangeOnline(startsAt: string | Date, now: Date, hours: number): boolean {
  const start = typeof startsAt === "string" ? Date.parse(startsAt) : startsAt.getTime();
  return start - now.getTime() >= hours * 3_600_000;
}

/** Only booked appointments can be changed; cancelled/released ones are final. */
export function manageable(status: string): boolean {
  return status === "booked";
}
