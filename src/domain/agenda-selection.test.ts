import { describe, expect, it } from 'vitest';
import { agendaPractitionerIds, agendaSelectedPractitioners, agendaWeekTracks } from './agenda-selection';
const people = [{ id: 'camille' }, { id: 'hugo' }, { id: 'rob' }];
describe('agenda practitioner filtering', () => {
  it('defaults to all practitioners rather than the first doctor', () => {
    expect(agendaSelectedPractitioners(people, agendaPractitionerIds(undefined))).toEqual(people);
    expect(agendaWeekTracks(['2026-10-19'], people.map(p => p.id)).map(t => t.practitionerId)).toEqual(['camille', 'hugo', 'rob']);
  });
  it('includes multiple selected people and excludes the rest', () => {
    expect(agendaSelectedPractitioners(people, ['hugo', 'rob'])).toEqual([{ id: 'hugo' }, { id: 'rob' }]);
  });
  it('removing the final selection returns to all people', () => {
    const selected = ['hugo'].filter(id => id !== 'hugo');
    expect(agendaSelectedPractitioners(people, selected)).toEqual(people);
  });
  it('preserves old single-person links but prefers explicit multiple selection', () => {
    expect(agendaPractitionerIds(undefined, 'hugo')).toEqual(['hugo']);
    expect(agendaPractitionerIds(['rob', 'hugo'], 'camille')).toEqual(['rob', 'hugo']);
  });
});