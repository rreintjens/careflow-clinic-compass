import { z } from "zod";

/** Landing page keys stored on `roles.landing_page` mapped to app paths. */
export const LANDING_PATHS = {
  dashboard: "/dashboard",
  "mijn-dag": "/agenda/mijn-dag",
  agenda: "/agenda",
  patienten: "/patienten",
} as const;
export type LandingKey = keyof typeof LANDING_PATHS;

export function landingPath(key: string | null | undefined): (typeof LANDING_PATHS)[LandingKey] | "/auth" {
  if (key && key in LANDING_PATHS) return LANDING_PATHS[key as LandingKey];
  return "/auth";
}

/** Same schema on client and server. Policy: min 12 characters (breach check runs in auth). */
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const PASSWORD_MIN_LENGTH = 12;

export type LockState = { failedCount: number; lockedUntil: string | null };

export function isLocked(state: LockState | null, now: Date): boolean {
  return Boolean(state?.lockedUntil && new Date(state.lockedUntil) > now);
}

/** Next lockout state after a failed attempt. After `maxAttempts` failures the account locks for `lockMinutes`. */
export function registerFailure(
  state: LockState | null,
  now: Date,
  maxAttempts: number,
  lockMinutes: number,
): LockState {
  const expired = state?.lockedUntil && new Date(state.lockedUntil) <= now;
  const failedCount = (expired ? 0 : (state?.failedCount ?? 0)) + 1;
  if (failedCount >= maxAttempts) {
    return { failedCount, lockedUntil: new Date(now.getTime() + lockMinutes * 60_000).toISOString() };
  }
  return { failedCount, lockedUntil: null };
}

/** Roles that see medical data get the short idle timeout. */
export function needsShortIdleTimeout(permissions: readonly string[]): boolean {
  return permissions.includes("patients.medical");
}
