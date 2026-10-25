import { parentsOfTreatment, treatmentsIn, type MenuData } from './menu';

export interface BookingCoverage { id: string; kind: string; bookable: readonly string[] }

/** Compare clinical peers in each placement; online-only services are a different channel. */
export function missingGroupLocations(menu: MenuData, treatments: readonly BookingCoverage[], treatmentId: string, clinicIds: readonly string[]): string[] {
  const byId = new Map(treatments.map(t => [t.id, t]));
  const target = byId.get(treatmentId);
  if (!target) return [];
  const clinics = new Set(clinicIds);
  const clinical = (t: BookingCoverage) => t.bookable.filter(id => clinics.has(id));
  if (target.bookable.length && !clinical(target).length) return [];
  const missing = new Set<string>();
  const placements = parentsOfTreatment(menu, treatmentId);
  for (const parent of placements) {
    let peers = treatmentsIn(menu, parent).map(id => byId.get(id)).filter((t): t is BookingCoverage => !!t && t.id !== treatmentId && clinical(t).length > 0);
    // A general consult directory mixes unrelated specialties; it is not a clinical peer group.
    if (peers.length && target.kind === 'consult' && peers.every(t => t.kind === 'consult')) continue;
    if (!peers.length) {
      let ancestor = menu.groups.find(g => g.id === parent)?.parent_id;
      while (ancestor && !peers.length) {
        peers = treatmentsIn(menu, ancestor).map(id => byId.get(id)).filter((t): t is BookingCoverage => !!t && t.id !== treatmentId && t.kind === 'consult' && clinical(t).length > 0);
        ancestor = menu.groups.find(g => g.id === ancestor)?.parent_id;
      }
      // A singleton consult can also live in the general consult directory: use its broadest consult coverage.
      if (!peers.length && target.kind === 'consult') {
        const alternatives = placements.filter(p => p !== parent).flatMap(p => treatmentsIn(menu, p)).map(id => byId.get(id)).filter((t): t is BookingCoverage => !!t && t.id !== treatmentId && t.kind === 'consult');
        const max = Math.max(0, ...alternatives.map(t => clinical(t).length));
        peers = alternatives.filter(t => clinical(t).length === max && max > 0);
      }
    }
    for (const id of clinicIds) if (peers.length && peers.filter(t => t.bookable.includes(id)).length > peers.length / 2 && !target.bookable.includes(id)) missing.add(id);
  }
  return [...missing];
}
