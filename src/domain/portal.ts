import { z } from "zod";

export const portalEmailSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
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