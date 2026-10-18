import { describe, expect, it } from "vitest";
import { bmiOf, measurementWithBmi, measurementSchema } from "./measurements";

describe("BMI from stored measurements", () => {
  it("calculates BMI from 110 kg and 180 cm", () => { expect(bmiOf(110, 180)).toBeCloseTo(33.950617, 5); });
  it("does not invent a BMI when height is missing", () => { expect(bmiOf(110, null)).toBeNull(); });
  it("reuses previously measured height with the new weight", () => {
    expect(measurementWithBmi({ measured_on: "2026-10-18", weight_kg: 110, height_cm: null }, [{ measured_on: "2026-10-17", weight_kg: 115, height_cm: 180 }]).bmi).toBeCloseTo(33.950617, 5);
  });
  it("does not use a future height to recalculate a past measurement", () => {
    expect(measurementWithBmi({ measured_on: "2026-10-18", weight_kg: 110, height_cm: null }, [{ measured_on: "2026-10-19", weight_kg: 110, height_cm: 180 }]).bmi).toBeNull();
  });
  it("accepts comma decimals and rejects invalid numeric input", () => {
    const row = { patientId: "1ff9599e-6bf7-4e06-9ea0-4d07c74a81b2", date: "2026-10-18", weight: "110,5", height: "180", waist: "", sys: "", dia: "", pulse: "" };
    expect(measurementSchema.parse(row).weight).toBe(110.5);
    expect(measurementSchema.safeParse({ ...row, weight: "geen getal" }).success).toBe(false);
  });
});