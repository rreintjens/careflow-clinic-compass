import { describe, expect, it } from "vitest";

import { canSendMail, canSwitchTo, normalizeHost, pickActiveTenant } from "./tenancy";

const ms = [
  { tenantId: "de", sort: 2 },
  { tenantId: "nl", sort: 1 },
];

describe("pickActiveTenant", () => {
  it.each([
    ["keeps a valid current tenant", "de", "de"],
    ["falls back to the first tenant by order", null, "nl"],
    ["ignores a tenant without membership", "obesitas", "nl"],
  ])("%s", (_l, current, expected) => {
    expect(pickActiveTenant(ms, current)).toBe(expected);
  });
  it("returns null without memberships", () => {
    expect(pickActiveTenant([], "nl")).toBeNull();
  });
});

describe("canSwitchTo", () => {
  it("allows a membership tenant", () => expect(canSwitchTo(ms, "de")).toBe(true));
  it("refuses a tenant without membership", () => expect(canSwitchTo(ms, "obesitas")).toBe(false));
});

describe("canSendMail", () => {
  it.each([
    [{ mail_sender: "noreply@bodyclinic.nl", mail_sender_verified: true }, true],
    [{ mail_sender: "noreply@bodyclinic.nl", mail_sender_verified: false }, false],
    [{ mail_sender: null, mail_sender_verified: true }, false],
  ])("%o -> %s", (t, expected) => expect(canSendMail(t)).toBe(expected));
});

describe("normalizeHost", () => {
  it.each([
    ["Boek.BodyClinic.nl:443", "boek.bodyclinic.nl"],
    ["", null],
    [null, null],
  ])("%s -> %s", (h, expected) => expect(normalizeHost(h)).toBe(expected));
});
