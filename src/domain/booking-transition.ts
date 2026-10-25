import type { Step } from './booking';

export const BOOKING_TAP_MS = 100;
export const BOOKING_SLIDE_MS = 280;
export const BOOKING_FADE_MS = 120;

/** Screen identity deliberately excludes day, time and the preferred practitioner in the planner. */
export function bookingScreenKey(step: Step, phase?: string): string {
  if (step.kind === 'menu') return `menu:${step.group ?? 'root'}`;
  if (step.kind === 'none') return 'none';
  return `${step.kind}:${step.treatment}:${'location' in step ? step.location : ''}:${phase ?? ''}`;
}
export function bookingHistoryDirection(previous: number, next: number): 'forward' | 'back' {
  return next < previous ? 'back' : 'forward';
}
