import { z } from "zod";

/** Booking draft sent along with a login link: the exact flow state, plus hold and triage when the patient already chose a time. */
export const portalDraftSchema = z.object({
  params: z.string().max(600),
  treatmentId: z.string().uuid().optional(), locationId: z.string().uuid().optional(), practitionerId: z.string().max(40).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  confirm: z.boolean().optional(), holdToken: z.string().uuid().optional(),
  triageKey: z.string().max(80).optional(), triageVersionId: z.string().uuid().optional(), triageAnswers: z.record(z.string(), z.unknown()).optional(),
});
export const portalEmailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), merk: z.string().max(60).optional(), returnTo: z.string().max(600).optional(), draft: portalDraftSchema.optional() });
export const portalTokenSchema = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) });
export const PORTAL_LINK_MINUTES = 10;
export function usablePortalToken(expiresAt: string, usedAt: string | null, now: number) {
  return usedAt === null && Date.parse(expiresAt) > now;
}
type Package = { order_id: string; start_date: string; months: number; status: string };
export function packageEnd(start: string, months: number) {
  const [y, m, d] = start.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) return start;
  const last = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, last))).toISOString().slice(0, 10);
}
/** Lines in one order represent one package; never six overlapping programmes. */
export function portalLanding(packages: readonly Package[], proposed: boolean, today: string) {
  const orders = new Map<string, Package>();
  for (const p of packages.filter(p => p.status === "active" || p.status === "completed")) {
    const previous = orders.get(p.order_id);
    orders.set(p.order_id, previous ? { ...previous, start_date: previous.start_date < p.start_date ? previous.start_date : p.start_date, months: previous.months + p.months } : { ...p });
  }
  const list = [...orders.values()].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const active = list.find(p => p.start_date <= today && today < packageEnd(p.start_date, p.months));
  if (active) return { kind: "active" as const, package: active, stoppedOn: null };
  if (list.length === 0 && proposed) return { kind: "starter" as const, package: null, stoppedOn: null };
  const expired = list.find(p => packageEnd(p.start_date, p.months) <= today);
  if (expired) return { kind: "stopped" as const, package: null, stoppedOn: packageEnd(expired.start_date, expired.months) };
  return { kind: "general" as const, package: null, stoppedOn: null };
}

/** Initials: first letter of the first name plus first letter of the last name, skipping tussenvoegsels. */
const TUSSENVOEGSELS = new Set(["de", "van", "der", "den", "ten", "ter", "het", "'t"]);
export function patientInitials(firstName: string, lastName: string) {
  const parts = lastName.trim().split(/\s+/).filter(p => !TUSSENVOEGSELS.has(p.toLowerCase()));
  const last = parts[0] ?? lastName.trim();
  return `${firstName.trim()[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

/** Per-treatment portal settings (nazorg, traject, herinnering), stored in treatments.portal_settings. */
export const portalSettingsSchema = z.object({
  course_count: z.number().int().min(1).max(6).optional(),
  course_interval: z.string().max(200).optional(),
  aftercare_days: z.union([z.literal(3), z.literal(7), z.literal(14), z.literal(30)]).optional(),
  reminder_weeks: z.union([z.literal(0), z.literal(4), z.literal(8), z.literal(12), z.literal(16), z.literal(24)]).optional(),
  aftercare_tips: z.array(z.string().max(300)).max(8).optional(),
});
export type PortalSettings = z.infer<typeof portalSettingsSchema>;
export function readPortalSettings(value: unknown): PortalSettings {
  const parsed = portalSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : {};
}

export const feedbackSchema = z.object({
  appointmentId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  tags: z.array(z.string().max(60)).max(5),
  comment: z.string().max(2000),
  share_with_practitioner: z.boolean(),
});

export type HistoryItem = { id: string; starts_at: string; treatment_id: string; practitioner_id: string | null };
/** Most recent completed treatment without feedback, within 30 days. */
export function feedbackDue(history: readonly HistoryItem[], given: readonly string[], today: string) {
  const cutoff = Date.parse(`${today}T00:00:00Z`) - 30 * 86_400_000;
  return [...history]
    .filter(h => Date.parse(h.starts_at) < Date.parse(`${today}T00:00:00Z`) && Date.parse(h.starts_at) >= cutoff && !given.includes(h.id))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0] ?? null;
}
export function weeksSince(startsAt: string, today: string) {
  return Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(startsAt)) / (7 * 86_400_000));
}
/** The patient's own practitioner for a category: the one visited most; ties and empty history fall back to the most recent. */
export function ownDoctor(history: readonly HistoryItem[], categoryTreatmentIds: readonly string[]) {
  const visits = history.filter(h => h.practitioner_id && categoryTreatmentIds.includes(h.treatment_id));
  if (!visits.length) return null;
  const counts = new Map<string, { n: number; last: string }>();
  for (const v of visits) {
    const c = counts.get(v.practitioner_id!) ?? { n: 0, last: v.starts_at };
    counts.set(v.practitioner_id!, { n: c.n + 1, last: c.last > v.starts_at ? c.last : v.starts_at });
  }
  return [...counts.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))[0]![0];
}
/** Bestellen (v0.1 §6): prijzen en opties komen uit portal_config.content.maConfig — nooit hardcoded. */
export const maConfigSchema = z.object({
  strengths: z.array(z.number()).min(2),
  basePrices: z.array(z.number()).min(2),
  discounts: z.record(z.string(), z.number()),
  packages: z.array(z.number().int()).min(1),
  support: z.array(z.object({ key: z.string(), name: z.string(), price: z.number(), lines: z.array(z.string()), tag: z.string().optional() })),
  extras: z.array(z.object({ key: z.string(), name: z.string(), price: z.number(), line: z.string() })),
  delivery: z.array(z.object({ key: z.string(), name: z.string(), price: z.number(), line: z.string() })),
  payment: z.array(z.object({ key: z.string(), name: z.string(), line: z.string() })),
});
export type MaConfig = z.infer<typeof maConfigSchema>;
export function readMaConfig(value: unknown): MaConfig | null {
  const parsed = maConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

const DAY = 86_400_000;
const asDay = (d: string) => Date.parse(`${d}T00:00:00Z`);
/** Bestelvenster: van 7 dagen voor het einde van het pakket tot de laatste dag. De countdown loopt naar het openingsmoment. */
export function orderWindow(startDate: string, months: number, today: string) {
  const end = packageEnd(startDate, months);
  const opens = new Date(asDay(end) - 7 * DAY).toISOString().slice(0, 10);
  const daysUntil = Math.ceil((asDay(opens) - asDay(today)) / DAY);
  return { opens, closes: end, daysUntil: Math.max(0, daysUntil), canOrder: today >= opens && today <= end };
}

/** Prijs per maand voor een sterkte in een pakket: basisprijs minus pakketkorting. */
export function monthPrice(config: MaConfig, strengthIndex: number, packageMonths: number) {
  const base = config.basePrices[strengthIndex] ?? 0;
  return base - (config.discounts[String(packageMonths)] ?? 0);
}
export function packageTotal(config: MaConfig, strengthIndexes: readonly number[], packageMonths: number) {
  return strengthIndexes.reduce((sum, i) => sum + monthPrice(config, i, packageMonths), 0);
}
/** Besparing ten opzichte van losse maanden met dezelfde sterktes. */
export function packageSavings(config: MaConfig, strengthIndexes: readonly number[], packageMonths: number) {
  const loose = strengthIndexes.reduce((sum, i) => sum + (config.basePrices[i] ?? 0), 0);
  return loose - packageTotal(config, strengthIndexes, packageMonths);
}

/** Pakketkiezer: t.o.v. de vorige maand is dezelfde of één stap omhoog toegestaan, twee stappen alleen met meekijkende arts, meer is geblokkeerd. */
export type StrengthState = "allowed" | "review" | "blocked";
export function strengthState(chosenIndex: number, previousIndex: number): StrengthState {
  const diff = chosenIndex - previousIndex;
  if (diff <= 1) return "allowed";
  if (diff === 2) return "review";
  return "blocked";
}
