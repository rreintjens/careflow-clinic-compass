import { describe, expect, it } from "vitest";

import { canChangeOnline, manageable } from "./manage";

const now = new Date("2026-10-19T10:30:00Z");

describe("canChangeOnline (24 hours before)", () => {
  it.each([
    ["2026-10-20T10:30:00Z", true],  // exactly 24h
    ["2026-10-20T10:29:00Z", false], // 23h59
    ["2026-10-22T09:00:00Z", true],
    ["2026-10-19T12:00:00Z", false],
  ])("%s → %s", (start, ok) => expect(canChangeOnline(start, now, 24)).toBe(ok));
});

describe("manageable", () => {
  it.each([["booked", true], ["cancelled", false], ["held", false], ["released", false]])("%s → %s", (s, ok) => expect(manageable(s)).toBe(ok));
});
