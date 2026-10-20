/**
 * Booking links: a pre-filled entry into the booking flow (treatment, locations, practitioner
 * mode, language) plus the reporting source that every booking through the link carries.
 * Pure rules only — the database decides which links exist, this decides what a link means.
 */
import { startScreenSchema } from "./start-screen";
import { z } from "zod";

export const bookingLinkSchema = z
  .object({
    id: z.string().uuid().nullable(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Gebruik kleine letters, cijfers en streepjes."),
  show_patient_login: z.boolean().default(true),
    name: z.string().trim().min(1, "Vul een naam in.").max(80),
    source: z.string().trim().max(60),
    treatment_id: z.string().uuid().nullable(),
    location_ids: z.array(z.string().uuid()).max(60),
    practitioner_mode: z.string().max(20).nullable(),
    practitioner_id: z.string().uuid().nullable(),
    treatment_ids: z.array(z.string().uuid()).max(500).default([]),
    category_ids: z.array(z.string().uuid()).max(100).default([]),
    practitioner_ids: z.array(z.string().uuid()).max(100).default([]),
    practitioner_scope: z.enum(["all", "selected"]).default("all"),
    language: z.enum(["nl", "en"]),
    start_screen_mode:z.enum(["treatment","custom","none"]).default("treatment"),start_screen:startScreenSchema.nullable().default(null),
    channel_id:z.string().uuid().nullable().default(null),place_id:z.string().uuid().nullable().default(null),campaign_id:z.string().uuid().nullable().default(null),extra:z.string().max(30).regex(/^[a-z0-9-]*$/).default(""),
    status: z.enum(["active", "inactive"]),
  })
  .superRefine((v, ctx) => {
    if (v.practitioner_id && v.practitioner_mode !== "fixed") {
      ctx.addIssue({ code: "custom", path: ["practitioner_id"], message: "Een behandelaar kiezen kan alleen bij de modus Vast." });
    }
  });
export type BookingLinkInput = z.infer<typeof bookingLinkSchema>;

/** What the modal edits; the same shape the row stores. */
export type LinkDraft = Pick<BookingLinkInput, "treatment_id" | "location_ids" | "practitioner_mode" | "practitioner_id">;

/** Minimal catalogue view: which locations offer a treatment, and what each practitioner does. */
export interface LinkCatalog {
  treatments: ReadonlyArray<{ id: string; locations: readonly string[]; categories?: readonly string[] }>;
  practitioners: ReadonlyArray<{ id: string; treatments: readonly string[]; locations: readonly string[]; exclusions?: ReadonlyArray<{ treatment_id: string; excluded_location_ids: readonly string[] }> }>;
  categories?: ReadonlyArray<{ id: string; parent_id: string | null }>;
}

export type LinkScope = LinkDraft & Partial<Pick<BookingLinkInput, "treatment_ids" | "category_ids" | "practitioner_ids" | "practitioner_scope">>;

/** Category selections resolve against the current catalogue, never a frozen treatment list. */
export function scopeTreatments(c: LinkCatalog, d: LinkScope): string[] {
  const treatments = d.treatment_ids?.length ? d.treatment_ids : d.treatment_id ? [d.treatment_id] : [];
  const categories = new Set(d.category_ids ?? []);
  for (const category of c.categories ?? []) if (category.parent_id && categories.has(category.parent_id)) categories.add(category.id);
  if (!treatments.length && !categories.size) return c.treatments.map(t => t.id);
  return c.treatments.filter(t => treatments.includes(t.id) || t.categories?.some(id => categories.has(id))).map(t => t.id);
}

export function scopePractitioners(c: LinkCatalog, d: LinkScope, treatmentId: string, locationId?: string): string[] {
  const treatment = c.treatments.find(t => t.id === treatmentId);
  const locations = treatment?.locations.filter(l => d.location_ids.includes(l) && (!locationId || l === locationId)) ?? [];
  return c.practitioners.filter(p => p.treatments.includes(treatmentId)
    && (d.practitioner_scope !== "selected" || d.practitioner_ids?.includes(p.id))
    && locations.some(l => p.locations.includes(l) && !p.exclusions?.find(e => e.treatment_id === treatmentId)?.excluded_location_ids.includes(l))).map(p => p.id);
}

export function scopeUnbookable(c: LinkCatalog, d: LinkScope): string[] {
  return scopeTreatments(c, d).filter(id => !scopePractitioners(c, d, id).length);
}

/** Locations the patient can still pick: the chosen ones that actually offer the fixed treatment. */
export function linkLocations(c: LinkCatalog, d: LinkDraft): string[] {
  const chosen = [...new Set(d.location_ids)];
  if (!d.treatment_id) return chosen;
  const offers = new Set(c.treatments.find((t) => t.id === d.treatment_id)?.locations ?? []);
  return chosen.filter((l) => offers.has(l));
}

/** Practitioners who do this treatment (if fixed) at one of the link's locations. */
export function linkPractitioners(c: LinkCatalog, d: LinkDraft): string[] {
  const at = new Set(linkLocations(c, d));
  return c.practitioners
    .filter((p) => (!d.treatment_id || p.treatments.includes(d.treatment_id)) && p.locations.some((l) => at.has(l)))
    .map((p) => p.id);
}

/** The one rule the modal checks before it lets you save: a link needs a location the treatment is done at. */
export function linkProblem(c: LinkCatalog, d: LinkDraft): "no_location" | "no_practitioner" | "practitioner_unavailable" | null {
  if (linkLocations(c, d).length === 0) return "no_location";
  if (d.practitioner_mode === "fixed") {
    if (!d.practitioner_id) return "no_practitioner";
    if (!linkPractitioners(c, d).includes(d.practitioner_id)) return "practitioner_unavailable";
  }
  return null;
}

/** Which patient steps the link answers in advance. */
export function linkSkips(d: LinkDraft): { treatment: boolean; location: boolean; practitioner: boolean } {
  return {
    treatment: !!d.treatment_id,
    location: !d.treatment_id ? d.location_ids.length === 1 : linkLocations({ treatments: [], practitioners: [] }, d).length === 1 || d.location_ids.length === 1,
    practitioner: d.practitioner_mode === "fixed" || d.practitioner_mode === "assigned",
  };
}

/** URL parts of a link: the path the patient opens, and the same as an absolute URL for a host. */
export const bookingLinkPath = (slug: string) => `/boeken?link=${encodeURIComponent(slug)}`;
export function absoluteBookingLink(slug: string, host: string | null) {
  const base = host ? `https://${host}` : "";
  return `${base}${bookingLinkPath(slug)}`;
}

/**
 * The same link as a UTM-tagged URL for the clinic's own analytics: utm_source follows the
 * reporting source (or the slug when empty), utm_campaign is the link itself. Our own source
 * tracking already rides on ?link=; these parameters are for tools like Google Analytics.
 */
export function bookingLinkUtm(slug: string, source: string): string {
  const utmSource = slugify(source) === "link" || !source.trim() ? slug : slugify(source);
  return `${bookingLinkPath(slug)}&utm_source=${encodeURIComponent(utmSource)}&utm_campaign=${encodeURIComponent(slug)}`;
}
export function absoluteBookingLinkUtm(slug: string, source: string, host: string | null) {
  const base = host ? `https://${host}` : "";
  return `${base}${bookingLinkUtm(slug, source)}`;
}

const slugify = (name: string) => {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base.length >= 2 ? base : "link";
};

/** A short, readable, still-free slug for the link. */
export function uniqueSlug(taken: readonly string[], name: string): string {
  const base = slugify(name);
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const next = `${base}-${i}`;
    if (!taken.includes(next) && next.length <= 40) return next;
  }
  return `${base}-${Date.now()}`.slice(0, 40);
}
