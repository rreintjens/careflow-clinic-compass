/**
 * Google Meet and Google Agenda behind one interface. In test mode a mock creates the same
 * shape of link without touching Google, so the rest of the app only ever sees a link on the
 * appointment row: rescheduling keeps the row, so it keeps the link.
 */

export interface MeetingInput {
  /** Stable key for the appointment; the mock derives the link from it, so it never changes. */
  appointmentId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  patientName: string;
  practitionerEmail: string | null;
  timeZone: string;
}

export interface Meeting {
  link: string;
  calendarId: string;
  created_at: string;
}

export interface MeetingProvider {
  readonly account: string;
  /** Idempotent per appointment: the same appointment always yields the same link. */
  create(input: MeetingInput): Promise<Meeting>;
  /** A real provider moves the calendar event; the link itself stays the same. */
  move?(input: MeetingInput, meeting: Meeting): Promise<Meeting>;
  cancel?(meeting: Meeting): Promise<void>;
}

export const needsMeeting = (locationKind: string | null | undefined) => locationKind === "online";

const MEET_LINK = /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/;
export const isMeetingLink = (value: string | null | undefined): value is string => !!value && MEET_LINK.test(value);

const LETTERS = "abcdefghij";

/** Deterministic three-four-three code from the appointment id: same row, same link, always. */
export function meetCode(seed: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(seed)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const out: string[] = [];
  for (let i = 0; i < 10; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
    out.push(LETTERS[h % LETTERS.length]);
  }
  return `${out.slice(0, 3).join("")}-${out.slice(3, 7).join("")}-${out.slice(7, 10).join("")}`;
}

/** Test-mode provider: no Google calls, same contract, links that look the part. */
export function mockMeetingProvider(account: string): MeetingProvider {
  return {
    account,
    create: async (input) => ({
      link: `https://meet.google.com/${meetCode(input.appointmentId)}`,
      calendarId: `mock-${input.appointmentId}`,
      created_at: new Date().toISOString(),
    }),
    move: async (_input, meeting) => meeting,
    cancel: async () => undefined,
  };
}

/** Only the real provider is wired when a live Google account is connected. */
export function meetingProvider(account: string, live: boolean): MeetingProvider {
  if (live) throw new Error("Google Meet is not connected in this environment.");
  return mockMeetingProvider(account);
}
