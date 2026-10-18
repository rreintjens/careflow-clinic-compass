import { z } from "zod";

export type MeasurementSource = { measured_on: string; weight_kg: number | null; height_cm: number | null };

export function bmiOf(weight: number | null, height: number | null): number | null {
  if (weight === null || height === null || !Number.isFinite(weight) || !Number.isFinite(height) || weight <= 0 || height <= 0) return null;
  return weight / (height / 100) ** 2;
}

/** Height is reused from the latest known measurement at or before the weight date. */
export function measurementWithBmi<T extends MeasurementSource>(row: T, history: ReadonlyArray<MeasurementSource>) {
  const height = row.height_cm ?? [...history].filter((m) => m.height_cm !== null && m.height_cm > 0 && m.measured_on <= row.measured_on).sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0]?.height_cm ?? null;
  return { ...row, height_cm: height, bmi: bmiOf(row.weight_kg, height) };
}

const numberField = z.preprocess((value) => typeof value === "string" ? value.trim() === "" ? null : Number(value.replace(",", ".")) : value, z.number().positive().finite().nullable());
const integerField = z.preprocess((value) => typeof value === "string" ? value.trim() === "" ? null : Number(value.replace(",", ".")) : value, z.number().int().positive().finite().nullable());
export const measurementSchema = z.object({
  patientId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => { const d = new Date(`${date}T12:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date; }),
  weight: numberField, height: numberField, waist: numberField, sys: integerField, dia: integerField, pulse: integerField,
});