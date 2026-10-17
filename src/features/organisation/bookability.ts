import { equipmentLite, offeredLocationIds, workLocationIds, type Org } from "@/data/organisation";
import { locationBookability, type BookabilityReason } from "@/domain/organisation";

export function treatmentBookability(org: Org, treatmentId: string) {
  const offered = offeredLocationIds(org, treatmentId);
  const requirements = org.requirements
    .filter((r) => r.treatment_id === treatmentId)
    .map((r) => ({ kind: r.kind as "room" | "equipment", equipment_kind: r.equipment_kind }));
  const practitioners = org.practitionerTreatments
    .filter((pt) => pt.treatment_id === treatmentId)
    .filter((pt) => org.practitioners.find((p) => p.id === pt.practitioner_id)?.status === "active")
    .map((pt) => ({ practitioner_id: pt.practitioner_id, location_ids: workLocationIds(org, pt.practitioner_id), excluded_location_ids: pt.excluded_location_ids }));
  const eq = equipmentLite(org);
  const perLocation: Array<{ locationId: string; reason: BookabilityReason }> = offered.map((id) => {
    const location = org.locations.find((l) => l.id === id);
    return {
      locationId: id,
      reason: location
        ? locationBookability({ location: { id, name: location.name, kind: location.kind as "online" | "clinic" }, requirements, practitioners, offeredLocationIds: offered, rooms: org.rooms, equipment: eq })
        : "no_room",
    };
  });
  return { offered, perLocation, ok: perLocation.filter((p) => p.reason === "ok").length, total: offered.length, practitionerCount: practitioners.length };
}

/** "5 klinieken", "Online en 12 klinieken", "Alleen online". */
export function offeredSummary(org: Org, offered: string[]) {
  const online = offered.some((id) => org.locations.find((l) => l.id === id)?.kind === "online");
  const clinics = offered.length - (online ? 1 : 0);
  if (online && clinics === 0) return "Alleen online";
  const c = `${clinics} ${clinics === 1 ? "kliniek" : "klinieken"}`;
  return online ? `Online en ${c}` : c;
}

export const REASON_TEXT: Record<BookabilityReason, string> = {
  ok: "",
  no_practitioner: "Geen behandelaar die hier werkt.",
  no_room: "Geen kamer op deze locatie.",
  no_equipment: "Benodigde apparatuur niet op deze locatie.",
};

/** Treatments offered at a location that cannot be booked there. */
export function notBookableAt(org: Org, locationId: string) {
  return org.treatmentLocations
    .filter((tl) => tl.location_id === locationId)
    .filter((tl) => treatmentBookability(org, tl.treatment_id).perLocation.find((p) => p.locationId === locationId)?.reason !== "ok").length;
}

