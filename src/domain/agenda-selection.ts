/** An empty selection means everyone; singular links remain compatible. */
export function agendaPractitionerIds(selected: readonly string[] | undefined, legacy?: string) {
  return [...new Set(selected ?? (legacy ? [legacy] : []))];
}
export function agendaSelectedPractitioners<T extends { id: string }>(people: readonly T[], selected: readonly string[]) {
  return people.filter(person => selected.length === 0 || selected.includes(person.id));
}
export function agendaWeekTracks(days: readonly string[], practitionerIds: readonly string[]) {
  return days.flatMap(date => practitionerIds.map(practitionerId => ({ date, practitionerId, key: `${date}:${practitionerId}` })));
}