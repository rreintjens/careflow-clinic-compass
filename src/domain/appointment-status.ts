/** One operational status set for agenda, slot protection and reception. */
export const agendaStatuses = ["booked", "tentatief", "gearriveerd", "in_behandeling", "klaar_voor_betaling", "afgerond", "no_show"];
export const blockingStatuses = ["booked", "tentatief", "gearriveerd", "in_behandeling", "klaar_voor_betaling", "afgerond"];
export function blocksAppointment(status: string, expires: number | null, now: number) {
  return blockingStatuses.includes(status) || (status === "held" && expires !== null && expires > now);
}
export function authorizedDoubleBooking(permission: boolean, reason: string | undefined): boolean {
  return permission && (reason?.trim().length ?? 0) >= 3;
}
/** Reception cannot start/finish a clinical workflow or settle unpaid bills by changing a status. */
export function receptionTransitions(status: string): string[] {
  if (status === "tentatief") return ["booked", "cancelled"];
  if (status === "booked") return ["gearriveerd", "no_show", "cancelled"];
  if (status === "gearriveerd") return ["booked", "no_show", "cancelled"];
  if (status === "no_show" || status === "cancelled") return ["booked"];
  return [];
}