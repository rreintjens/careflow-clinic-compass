import { queryOptions } from "@tanstack/react-query";

import type { EquipmentLite, Mobility } from "@/domain/organisation";
import { supabase } from "@/integrations/supabase/client";
import { practitionerPhotoBucket } from "@/data/tenant";
import type { Database } from "@/integrations/supabase/types";

type T = Database["public"]["Tables"];
export type Location = T["locations"]["Row"];
export type Room = T["rooms"]["Row"];
export type Treatment = T["treatments"]["Row"];
export type Category = T["treatment_categories"]["Row"];
export type Practitioner = T["practitioners"]["Row"];
export type PractitionerRole = T["practitioner_roles"]["Row"];
export type Equipment = T["equipment"]["Row"];
export type Requirement = T["treatment_requirements"]["Row"];
export type ScheduleBlock = T["schedule_blocks"]["Row"];
export type ScheduleException = T["schedule_exceptions"]["Row"];
export type LocationHours = T["location_hours"]["Row"];
export type Option = { value: string; label: string };

function must<D>(r: { data: D | null; error: unknown }): D {
  if (r.error) throw r.error;
  return r.data as D;
}

/** Everything the organisation screens read; small reference data, loaded together. */
export const orgQuery = queryOptions({
  queryKey: ["org"],
  queryFn: async () => {
    const [
      options, roles, languages, locations, hours, rooms, equipment, dayLocs, kinds, types, categories, treatments,
      catLinks, treatRoles, treatLocs, reqs, practitioners, pracLangs, pracLocs, pracTreats,
    ] = await Promise.all([
      supabase.from("option_lists").select("*").order("sort"),
      supabase.from("practitioner_roles").select("*").order("sort"),
      supabase.from("languages").select("*").order("sort"),
      supabase.from("locations").select("*").order("sort"),
      supabase.from("location_hours").select("*"),
      supabase.from("rooms").select("*").order("sort"),
      supabase.from("equipment").select("*").order("sort"),
      supabase.from("equipment_schedule").select("*"),
      supabase.from("equipment_kinds").select("*").order("sort"),
      supabase.from("equipment_types").select("*").order("brand").order("type"),
      supabase.from("treatment_categories").select("*").order("sort"),
      supabase.from("treatments").select("*").order("name_nl"),
      supabase.from("treatment_category_links").select("*").order("sort"),
      supabase.from("treatment_practitioner_roles").select("*"),
      supabase.from("treatment_locations").select("*"),
      supabase.from("treatment_requirements").select("*").order("sort"),
      supabase.from("practitioners").select("*").order("sort"),
      supabase.from("practitioner_languages").select("*"),
      supabase.from("practitioner_locations").select("*"),
      supabase.from("practitioner_treatments").select("*"),
    ]);
    return {
      options: must(options),
      roles: must(roles),
      languages: must(languages),
      locations: must(locations),
      hours: must(hours),
      rooms: must(rooms),
      equipment: must(equipment),
      dayLocations: must(dayLocs),
      equipmentKinds: must(kinds),
      equipmentTypes: must(types),
      categories: must(categories),
      treatments: must(treatments),
      categoryLinks: must(catLinks),
      treatmentRoles: must(treatRoles),
      treatmentLocations: must(treatLocs),
      requirements: must(reqs),
      practitioners: must(practitioners),
      practitionerLanguages: must(pracLangs),
      practitionerLocations: must(pracLocs),
      practitionerTreatments: must(pracTreats),
    };
  },
});
export type Org = Awaited<ReturnType<NonNullable<typeof orgQuery.queryFn>>>;

export const scheduleQuery = (practitionerId: string) =>
  queryOptions({
    queryKey: ["schedule", practitionerId],
    queryFn: async () => {
      const [blocks, exceptions] = await Promise.all([
        supabase.from("schedule_blocks").select("*").eq("practitioner_id", practitionerId).order("weekday").order("starts"),
        supabase.from("schedule_exceptions").select("*").eq("practitioner_id", practitionerId).order("date_from"),
      ]);
      return { blocks: must(blocks), exceptions: must(exceptions) };
    },
  });

export const allBlocksQuery = queryOptions({
  queryKey: ["schedule", "all-validity"],
  queryFn: async () => must(await supabase.from("schedule_blocks").select("practitioner_id, valid_until")),
});

export const generalDefaultsQuery = queryOptions({
  queryKey: ["settings", "org-defaults"],
  queryFn: async () => {
    const r = must(await supabase.from("settings").select("key, value").in("key", ["cancel_until_hours", "no_show_amount_cents"]));
    const get = (k: string) => r.find((x) => x.key === k)?.value;
    return { cancelHours: Number(get("cancel_until_hours") ?? 24), noShowCents: Number(get("no_show_amount_cents") ?? 0) };
  },
});

// ---------- selectors ----------
export const opts = (org: Org, listKey: string): Option[] =>
  org.options.filter((o) => o.list_key === listKey).map((o) => ({ value: o.value, label: o.label_nl }));
export const optLabel = (org: Org, listKey: string, value: string | null | undefined) =>
  org.options.find((o) => o.list_key === listKey && o.value === value)?.label_nl ?? "";

export const kindOpts = (org: Org): Option[] => org.equipmentKinds.map((k) => ({ value: k.key, label: k.name }));
export const kindName = (org: Org, key: string | null | undefined) => org.equipmentKinds.find((k) => k.key === key)?.name ?? "";
export const fullName = (p: Pick<Practitioner, "first_name" | "last_name">) => `${p.first_name} ${p.last_name}`;
export const roleName = (org: Org, roleId: string) => org.roles.find((r) => r.id === roleId)?.name_nl ?? "";
export const locName = (org: Org, id: string) => org.locations.find((l) => l.id === id)?.name ?? "";
export const workLocationIds = (org: Org, practitionerId: string) => {
  const ids = new Set(org.practitionerLocations.filter((x) => x.practitioner_id === practitionerId).map((x) => x.location_id));
  return org.locations.filter((l) => ids.has(l.id)).map((l) => l.id);
};
export const offeredLocationIds = (org: Org, treatmentId: string) => {
  const ids = new Set(org.treatmentLocations.filter((x) => x.treatment_id === treatmentId).map((x) => x.location_id));
  return org.locations.filter((l) => ids.has(l.id)).map((l) => l.id);
};
export const mainCategories = (org: Org) => org.categories.filter((c) => !c.parent_id);
export const subCategories = (org: Org, parentId: string) => org.categories.filter((c) => c.parent_id === parentId);
/** Main categories a treatment is in (via its subcategory or directly). */
export const treatmentMainCategoryIds = (org: Org, treatmentId: string) => {
  const ids = org.categoryLinks.filter((l) => l.treatment_id === treatmentId).map((l) => {
    const c = org.categories.find((x) => x.id === l.category_id);
    return c?.parent_id ?? c?.id ?? "";
  });
  return mainCategories(org).filter((c) => ids.includes(c.id)).map((c) => c.id);
};
export const equipmentLite = (org: Org): EquipmentLite[] =>
  org.equipment.map((e) => ({
    id: e.id,
    kind: e.kind,
    mobility: e.placement as Mobility,
    room_id: e.room_id,
    location_id: e.location_id,
    day_locations: org.dayLocations.filter((d) => d.equipment_id === e.id),
  }));

export function photoUrl(path: string | null): Promise<string | null> {
  if (!path) return Promise.resolve(null);
  return practitionerPhotoBucket()
    .then((b) => supabase.storage.from(b).createSignedUrl(path, 3600))
    .then((r) => r.data?.signedUrl ?? null);
}

// ---------- writes ----------
async function ok(p: PromiseLike<{ error: unknown }>) {
  const { error } = await p;
  if (error) throw error;
}

/** Replace a link set: delete rows not in `keep`, insert new ones. */
async function syncLinks<K extends string>(
  table: "treatment_locations" | "treatment_practitioner_roles" | "practitioner_locations" | "practitioner_languages" | "treatment_category_links",
  ownerCol: string,
  ownerId: string,
  linkCol: K,
  current: string[],
  next: string[],
) {
  const toDel = current.filter((x) => !next.includes(x));
  const toAdd = next.filter((x) => !current.includes(x));
  // Generated table types differ per table; this helper only touches two uuid/text columns.
  const tbl = supabase.from(table) as unknown as {
    delete: () => { eq: (c: string, v: string) => { in: (c: string, v: string[]) => PromiseLike<{ error: unknown }> } };
    insert: (rows: Record<string, string>[]) => PromiseLike<{ error: unknown }>;
  };
  if (toDel.length) await ok(tbl.delete().eq(ownerCol, ownerId).in(linkCol, toDel));
  if (toAdd.length) await ok(tbl.insert(toAdd.map((v) => ({ [ownerCol]: ownerId, [linkCol]: v }))));
}

export async function saveTreatment(
  org: Org,
  id: string,
  patch: T["treatments"]["Update"],
  links: { categoryIds: string[]; roleIds: string[]; locationIds: string[] },
) {
  await ok(supabase.from("treatments").update(patch).eq("id", id));
  await syncLinks("treatment_category_links", "treatment_id", id, "category_id", org.categoryLinks.filter((l) => l.treatment_id === id).map((l) => l.category_id), links.categoryIds);
  await syncLinks("treatment_practitioner_roles", "treatment_id", id, "role_id", org.treatmentRoles.filter((l) => l.treatment_id === id).map((l) => l.role_id), links.roleIds);
  await syncLinks("treatment_locations", "treatment_id", id, "location_id", org.treatmentLocations.filter((l) => l.treatment_id === id).map((l) => l.location_id), links.locationIds);
}

export async function createTreatment(row: { name_nl: string; duration_min: number; categoryId: string }) {
  const slug = `${row.name_nl.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
  const { data, error } = await supabase.from("treatments").insert({ slug, name_nl: row.name_nl, duration_min: row.duration_min }).select("id").single();
  if (error) throw error;
  await ok(supabase.from("treatment_category_links").insert({ treatment_id: data.id, category_id: row.categoryId }));
  await ok(supabase.from("treatment_requirements").insert({ treatment_id: data.id, kind: "room", quantity: 1 }));
  return data.id;
}

export async function saveCategoryOrder(ids: string[]) {
  for (let i = 0; i < ids.length; i++) await ok(supabase.from("treatment_categories").update({ sort: i }).eq("id", ids[i] as string));
}
export async function saveTreatmentOrder(categoryId: string, treatmentIds: string[]) {
  for (let i = 0; i < treatmentIds.length; i++)
    await ok(supabase.from("treatment_category_links").update({ sort: i }).eq("category_id", categoryId).eq("treatment_id", treatmentIds[i] as string));
}

export async function saveCategory(
  id: string | null,
  row: { name_nl: string; name_en: string | null; icon: string | null; cancel_until_hours: number | null; no_show_fee_eur: number | null; sort: number },
  subs: Array<{ id: string | null; name_nl: string }>,
  existingSubIds: string[],
) {
  let catId = id;
  if (catId) await ok(supabase.from("treatment_categories").update(row).eq("id", catId));
  else {
    const { data, error } = await supabase.from("treatment_categories").insert(row).select("id").single();
    if (error) throw error;
    catId = data.id;
  }
  const keep = subs.filter((s) => s.id).map((s) => s.id as string);
  const removed = existingSubIds.filter((x) => !keep.includes(x));
  if (removed.length) await ok(supabase.from("treatment_categories").delete().in("id", removed));
  for (let i = 0; i < subs.length; i++) {
    const s = subs[i] as { id: string | null; name_nl: string };
    if (s.id) await ok(supabase.from("treatment_categories").update({ name_nl: s.name_nl, sort: i }).eq("id", s.id));
    else await ok(supabase.from("treatment_categories").insert({ parent_id: catId, name_nl: s.name_nl, sort: i }));
  }
}

export async function addPractitionersToTreatment(treatmentId: string, practitionerIds: string[]) {
  if (!practitionerIds.length) return;
  await ok(supabase.from("practitioner_treatments").insert(practitionerIds.map((p) => ({ practitioner_id: p, treatment_id: treatmentId }))));
}
export async function addTreatmentsToPractitioner(practitionerId: string, treatmentIds: string[]) {
  if (!treatmentIds.length) return;
  await ok(supabase.from("practitioner_treatments").insert(treatmentIds.map((t) => ({ practitioner_id: practitionerId, treatment_id: t }))));
}
export async function setPractitionerTreatmentExclusions(practitionerId: string, treatmentId: string, excluded: string[]) {
  await ok(supabase.from("practitioner_treatments").update({ excluded_location_ids: excluded }).eq("practitioner_id", practitionerId).eq("treatment_id", treatmentId));
}
export async function removePractitionerTreatment(practitionerId: string, treatmentId: string) {
  await ok(supabase.from("practitioner_treatments").delete().eq("practitioner_id", practitionerId).eq("treatment_id", treatmentId));
}

export async function saveRequirement(id: string | null, row: T["treatment_requirements"]["Insert"]) {
  if (id) await ok(supabase.from("treatment_requirements").update(row).eq("id", id));
  else await ok(supabase.from("treatment_requirements").insert(row));
}
export async function deleteRequirement(id: string) {
  await ok(supabase.from("treatment_requirements").delete().eq("id", id));
}

export async function savePractitioner(
  org: Org,
  id: string,
  patch: T["practitioners"]["Update"],
  links: { languageCodes: string[]; locationIds: string[] },
) {
  await ok(supabase.from("practitioners").update(patch).eq("id", id));
  await syncLinks("practitioner_languages", "practitioner_id", id, "language_code", org.practitionerLanguages.filter((l) => l.practitioner_id === id).map((l) => l.language_code), links.languageCodes);
  await syncLinks("practitioner_locations", "practitioner_id", id, "location_id", org.practitionerLocations.filter((l) => l.practitioner_id === id).map((l) => l.location_id), links.locationIds);
}
export async function createPractitioner(row: { first_name: string; last_name: string; role_id: string; locationIds: string[] }) {
  const slug = `${row.first_name}-${row.last_name}-${Math.random().toString(36).slice(2, 6)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data, error } = await supabase.from("practitioners").insert({ slug, first_name: row.first_name, last_name: row.last_name, role_id: row.role_id }).select("id").single();
  if (error) throw error;
  if (row.locationIds.length) await ok(supabase.from("practitioner_locations").insert(row.locationIds.map((l) => ({ practitioner_id: data.id, location_id: l }))));
  return data.id;
}
export async function uploadPractitionerPhoto(practitionerId: string, file: File) {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${practitionerId}/${Date.now()}.${ext}`;
  const up = await supabase.storage.from(await practitionerPhotoBucket()).upload(path, file, { upsert: true, contentType: file.type });
  if (up.error) throw up.error;
  await ok(supabase.from("practitioners").update({ photo_path: path }).eq("id", practitionerId));
}

export async function saveLocation(id: string, patch: T["locations"]["Update"]) {
  await ok(supabase.from("locations").update(patch).eq("id", id));
}
export async function createLocation(row: { name: string; address: string; postal_city: string }) {
  const slug = `${row.name}-${Math.random().toString(36).slice(2, 6)}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data, error } = await supabase.from("locations").insert({ slug, kind: "clinic", ...row, sort: 999 }).select("id").single();
  if (error) throw error;
  return data.id;
}
export async function saveHours(locationId: string, rows: Array<{ weekday: number; opens: string | null; closes: string | null; closed: boolean }>, existing: number[]) {
  for (const r of rows) {
    const v = { opens: r.closed ? null : r.opens, closes: r.closed ? null : r.closes, closed: r.closed };
    if (existing.includes(r.weekday)) await ok(supabase.from("location_hours").update(v).eq("location_id", locationId).eq("weekday", r.weekday));
    else await ok(supabase.from("location_hours").insert({ location_id: locationId, weekday: r.weekday, ...v }));
  }
}
export async function addLocationException(row: T["location_exceptions"]["Insert"]) {
  await ok(supabase.from("location_exceptions").insert(row));
}
export async function saveRoom(id: string | null, row: { location_id: string; name: string; sort: number; purpose?: string }) {
  if (id) await ok(supabase.from("rooms").update({ name: row.name, ...(row.purpose !== undefined ? { purpose: row.purpose } : {}) }).eq("id", id));
  else await ok(supabase.from("rooms").insert(row));
}
export async function deleteRoom(id: string) {
  await ok(supabase.from("rooms").delete().eq("id", id));
}

export interface DeviceInput {
  type_id: string; placement: "fixed_room" | "movable_location" | "travelling"; location_id: string | null; room_id: string | null;
  status: string; maintenance_interval_months: number | null; next_maintenance_on: string | null;
}
/** Saves a device; the deprecated name/kind/mobility columns are kept in sync for old readers. */
export async function saveEquipment(id: string | null, row: DeviceInput, legacy: { name: string; kind: string }, schedule: Array<{ weekday: number; location_id: string | null }>) {
  const full = { ...row, name: legacy.name, kind: legacy.kind, mobility: row.placement === "fixed_room" ? "fixed_room" : row.placement === "movable_location" ? "within_location" : "between_locations" };
  let eid = id;
  if (eid) await ok(supabase.from("equipment").update(full).eq("id", eid));
  else {
    const { data, error } = await supabase.from("equipment").insert({ ...full, sort: 999 }).select("id").single();
    if (error) throw error;
    eid = data.id;
  }
  await ok(supabase.from("equipment_schedule").delete().eq("equipment_id", eid));
  if (row.placement === "travelling" && schedule.length)
    await ok(supabase.from("equipment_schedule").insert(schedule.map((d) => ({ equipment_id: eid as string, ...d }))));
}
export async function saveEquipmentType(row: { kind_id: string; brand: string; type: string }) {
  const { data, error } = await supabase.from("equipment_types").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
}
/** Saves a kind and sets exactly which treatments require it (CRUD on treatment_requirements). */
export async function saveEquipmentKind(org: Org, id: string | null, row: { key: string; name: string; sort: number; parent_id: string | null }, treatmentIds: string[]) {
  if (id) await ok(supabase.from("equipment_kinds").update({ name: row.name, parent_id: row.parent_id }).eq("id", id));
  else await ok(supabase.from("equipment_kinds").insert(row));
  const current = org.requirements.filter((r) => r.kind === "equipment" && r.equipment_kind === row.key);
  for (const r of current) if (!treatmentIds.includes(r.treatment_id)) await deleteRequirement(r.id);
  const missing = treatmentIds.filter((t) => !current.some((r) => r.treatment_id === t));
  if (missing.length)
    await ok(supabase.from("treatment_requirements").insert(missing.map((t) => ({ treatment_id: t, kind: "equipment", equipment_kind: row.key, quantity: 1, duration: "whole", sort: 99 }))));
}
export async function deleteEquipmentKind(id: string) {
  await ok(supabase.from("equipment_kinds").delete().eq("id", id));
}
export async function deleteEquipment(id: string) {
  await ok(supabase.from("equipment").delete().eq("id", id));
}
export async function addEquipmentException(row: T["equipment_exceptions"]["Insert"]) {
  await ok(supabase.from("equipment_exceptions").insert(row));
}

export async function saveBlock(id: string | null, row: T["schedule_blocks"]["Insert"]) {
  if (id) await ok(supabase.from("schedule_blocks").update(row).eq("id", id));
  else await ok(supabase.from("schedule_blocks").insert(row));
}
export async function deleteBlock(id: string) {
  await ok(supabase.from("schedule_blocks").delete().eq("id", id));
}
export async function saveException(id: string | null, row: T["schedule_exceptions"]["Insert"]) {
  if (id) await ok(supabase.from("schedule_exceptions").update(row).eq("id", id));
  else await ok(supabase.from("schedule_exceptions").insert(row));
}
export async function deleteException(id: string) {
  await ok(supabase.from("schedule_exceptions").delete().eq("id", id));
}
