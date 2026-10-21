import { z } from 'zod';

export const portalTreatmentSchema = z.object({
  notes: z.array(z.object({ id: z.string().uuid(), patientNote: z.string(), aftercare: z.string(), gpLetter: z.string(), reminderDays: z.number().int().min(0) })),
  photos: z.array(z.object({ id: z.string().uuid(), image: z.string(), slot: z.string(), createdAt: z.string() })),
  prescriptions: z.array(z.object({ id: z.string().uuid(), medication: z.string(), instructions: z.string(), status: z.string(), signedAt: z.string() })),
  consents: z.array(z.object({ id: z.string().uuid(), kind: z.string(), text: z.string().nullable(), signedAt: z.string(), granted: z.boolean() })),
});

/** Date-only arithmetic preserves the clinic's calendar date through DST changes. */
export function treatmentReminderDate(startsAt: string, days: number): string | null {
  if (!Number.isInteger(days) || days <= 0) return null;
  const start = new Date(startsAt);
  if (!Number.isFinite(start.getTime())) return null;
  const calendar = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(start);
  const date = new Date(`${calendar}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function treatmentReminderDue(startsAt: string, days: number, now: string): boolean {
  const due = treatmentReminderDate(startsAt, days);
  const date = new Date(now);
  if (!due || !Number.isFinite(date.getTime())) return false;
  return due === new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(date);
}