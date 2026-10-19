import { z } from "zod";
import { addLocalDays, zonedParts } from "./time";

/** URL keys and database patient numbers can have different primitive types. */
export function isOtherPatientRecord(pathname: string, patient: { id: string; patient_number: string | number | null }) {
  const key = pathname.match(/^\/patienten\/([^/]+)/)?.[1];
  return !!key && decodeURIComponent(key) !== patient.id && decodeURIComponent(key) !== String(patient.patient_number ?? "");
}

export function consultTiming(startsAt: string, endsAt: string, now: number, tz = "Europe/Amsterdam") {
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  if (now < start) {
    const minutesUntil = Math.ceil((start - now) / 60_000);
    const day = zonedParts(new Date(start), tz).date, today = zonedParts(new Date(now), tz).date;
    const time = new Date(start).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tz });
    const when = day === today ? "vandaag" : day === addLocalDays(today, 1) ? "morgen" : new Date(start).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: tz });
    return { phase: "upcoming" as const, minutesUntil, minutesLeft: null, progress: 0, label: minutesUntil <= 60 ? `Begint over ${minutesUntil} minuten` : `Begint ${when} om ${time}` };
  }
  const minutesLeft = Math.max(0, Math.ceil((end - now) / 60_000));
  return { phase: "started" as const, minutesUntil: 0, minutesLeft, progress: Math.min(100, Math.max(0, (now - start) / Math.max(1, end - start) * 100)), label: `Nog ${minutesLeft} min` };
}

/** Shared browser/server validation for the standalone consult design. */
export const standaloneConsultSchema = z.object({
  patientId: z.string().uuid(),
  kind: z.string().min(1),
  practitionerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
    const parsed = new Date(`${date}T12:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
  }),
  timeAndDuration: z.string().trim().min(1),
  reason: z.string().trim(),
  subjective: z.string().trim(),
  objective: z.string().trim(),
  evaluation: z.string().trim(),
  plan: z.string().trim(),
  followUp: z.string().min(1),
  visibility: z.string().min(1),
});

export type StandaloneConsultInput = z.infer<typeof standaloneConsultSchema>;