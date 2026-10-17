/** Pure tenancy rules (no I/O). */

export interface Membership {
  tenantId: string;
  sort: number;
}

/** Keep the current active tenant when the user is still a member there; otherwise the first membership by tenant order. */
export function pickActiveTenant(memberships: readonly Membership[], current: string | null | undefined): string | null {
  if (current && memberships.some((m) => m.tenantId === current)) return current;
  const first = [...memberships].sort((a, b) => a.sort - b.sort)[0];
  return first?.tenantId ?? null;
}

/** A tenant may only switch to a tenant it holds a membership in. */
export function canSwitchTo(memberships: readonly Membership[], target: string): boolean {
  return memberships.some((m) => m.tenantId === target);
}

export interface MailSender {
  mail_sender: string | null;
  mail_sender_verified: boolean;
}

/** Mail is refused unless the tenant has its own verified sender domain. */
export function canSendMail(t: MailSender): boolean {
  return Boolean(t.mail_sender) && t.mail_sender_verified;
}

/** Host header -> booking host key (lowercase, no port). */
export function normalizeHost(host: string | null | undefined): string | null {
  if (!host) return null;
  const h = host.trim().toLowerCase().replace(/:\d+$/, "");
  return h || null;
}
