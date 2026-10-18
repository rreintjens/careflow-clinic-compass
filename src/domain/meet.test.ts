import { describe, expect, it } from "vitest";

import { isMeetingLink, meetCode, meetingProvider, mockMeetingProvider, needsMeeting } from "./meet";

const input = (appointmentId: string) => ({
  appointmentId,
  title: "Afspraak",
  startsAt: "2026-10-20T08:30:00Z",
  endsAt: "2026-10-20T09:00:00Z",
  patientName: "Test Persoon",
  practitionerEmail: null,
  timeZone: "Europe/Amsterdam",
});

describe("meetCode", () => {
  it("looks like a Meet code", () => {
    expect(meetCode("11111111-1111-1111-1111-111111111111")).toMatch(/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/);
  });
  it("is the same code for the same appointment and different for another", () => {
    expect(meetCode("a")).toBe(meetCode("a"));
    expect(meetCode("a")).not.toBe(meetCode("b"));
  });
});

describe("mockMeetingProvider", () => {
  it("gives one appointment one link, and never changes it on a move", async () => {
    const provider = mockMeetingProvider("agenda@bodyclinic.nl");
    const first = await provider.create(input("appt-1"));
    const again = await provider.create(input("appt-1"));
    expect(first.link).toBe(again.link);
    expect(isMeetingLink(first.link)).toBe(true);
    expect(provider.account).toBe("agenda@bodyclinic.nl");
    const moved = await provider.move?.(input("appt-1"), first);
    expect(moved?.link).toBe(first.link);
  });
  it("two appointments never share a link", async () => {
    const provider = mockMeetingProvider("agenda@bodyclinic.nl");
    const a = await provider.create(input("appt-1"));
    const b = await provider.create(input("appt-2"));
    expect(a.link).not.toBe(b.link);
  });
});

it("only online locations need a meeting", () => {
  expect(needsMeeting("online")).toBe(true);
  expect(needsMeeting("clinic")).toBe(false);
  expect(needsMeeting(null)).toBe(false);
});

it("the link must be a real Meet address", () => {
  expect(isMeetingLink("https://meet.google.com/abc-defg-hij")).toBe(true);
  expect(isMeetingLink("http://meet.google.com/abc-defg-hij")).toBe(false);
  expect(isMeetingLink("https://evil.test/meet.google.com/abc-defg-hij")).toBe(false);
  expect(isMeetingLink(null)).toBe(false);
});

it("a live account is not connected yet", () => {
  expect(() => meetingProvider("agenda@bodyclinic.nl", true)).toThrow();
  expect(meetingProvider("agenda@bodyclinic.nl", false).account).toBe("agenda@bodyclinic.nl");
});
