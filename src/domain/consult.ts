import { z } from "zod";

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