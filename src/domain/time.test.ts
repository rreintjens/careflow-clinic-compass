import { expect, it } from "vitest";
import { formatClinicalDate, zonedParts } from "./time";

it("preserves Eva's 14:23 Dutch completion instant", () => {
  expect(zonedParts(new Date("2026-10-19T12:23:37.889Z"), "Europe/Amsterdam")).toEqual({ date: "2026-10-19", minute: 14 * 60 + 23 });
});
it("does not fabricate a clock time for a date-only measurement", () => {
  expect(formatClinicalDate("2026-10-19", true)).toBe(formatClinicalDate("2026-10-19", false));
});
it("honors winter time for UTC instants", () => {
  expect(zonedParts(new Date("2026-11-19T12:23:00Z"), "Europe/Amsterdam").minute).toBe(13 * 60 + 23);
});