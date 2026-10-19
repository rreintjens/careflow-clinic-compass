import { describe, expect, it } from "vitest";

import { hasRegisteredAuthSession, isLocked, landingPath, needsShortIdleTimeout, registerFailure } from "./auth";

describe("registered session required for factor enrollment", () => {
  it.each([undefined, null, {}, { session_id: "" }, { session_id: "invalid" }])("rejects identity-only claims %j", (claims) => {
    expect(hasRegisteredAuthSession(claims)).toBe(false);
  });
  it("accepts a registered session identifier", () => {
    expect(hasRegisteredAuthSession({ session_id: "11111111-1111-4111-8111-111111111111" })).toBe(true);
  });
});

describe("landing page per role", () => {
  it.each([
    ["dashboard", "/dashboard"],
    ["mijn-dag", "/agenda/mijn-dag"],
    ["agenda", "/agenda"],
    ["patienten", "/patienten"],
    [null, "/auth"],
    ["onbekend", "/auth"],
  ])("%s -> %s", (key, path) => {
    expect(landingPath(key)).toBe(path);
  });
});

describe("lockout after 5 failed attempts for 15 minutes", () => {
  const now = new Date("2026-10-17T10:00:00Z");

  it("4 failures do not lock", () => {
    let s = null as ReturnType<typeof registerFailure> | null;
    for (let i = 0; i < 4; i++) s = registerFailure(s, now, 5, 15);
    expect(isLocked(s, now)).toBe(false);
  });

  it("the 5th failure locks until 15 minutes later", () => {
    let s = null as ReturnType<typeof registerFailure> | null;
    for (let i = 0; i < 5; i++) s = registerFailure(s, now, 5, 15);
    expect(isLocked(s, new Date("2026-10-17T10:14:59Z"))).toBe(true);
    expect(isLocked(s, new Date("2026-10-17T10:15:01Z"))).toBe(false);
  });

  it("counter restarts after an expired lock", () => {
    const locked = { failedCount: 5, lockedUntil: "2026-10-17T09:00:00Z" };
    expect(registerFailure(locked, now, 5, 15)).toEqual({ failedCount: 1, lockedUntil: null });
  });
});

describe("idle timeout", () => {
  it("applies to roles that see medical data", () => {
    expect(needsShortIdleTimeout(["patients.view", "patients.medical"])).toBe(true);
    expect(needsShortIdleTimeout(["patients.view"])).toBe(false);
  });
});
