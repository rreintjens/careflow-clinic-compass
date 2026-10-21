import { describe, expect, it } from 'vitest';
import { treatmentReminderDate } from './portal-treatment';

describe('Behandelherinnering', () => {
  it('gebruikt de 120 dagen van het Botox-consult', () => {
    expect(treatmentReminderDate('2026-10-21T14:00:00Z', 120)).toBe('2027-02-18');
  });
  it('maakt geen herinnering bij nul dagen', () => {
    expect(treatmentReminderDate('2026-10-21T14:00:00Z', 0)).toBeNull();
  });
  it('behoudt de Nederlandse datum bij een UTC-daggrens', () => {
    expect(treatmentReminderDate('2026-10-24T23:30:00Z', 1)).toBe('2026-10-26');
  });
});