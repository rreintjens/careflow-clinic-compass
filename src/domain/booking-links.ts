/**
 * Booking links: a pre-filled entry into the booking flow (treatment, locations, practitioner
 * mode, language) plus the reporting source that every booking through the link carries.
 * Pure rules only — the database decides which links exist, this decides what a link means.
 */
import { z } from "zod";

export const bookingLinkSchema = z
  .object({
    id: z.string().uuid().nullable(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Gebruik kleine letters, cijfers en streepjes."),
    name: z.string().trim().min(1, "Vul een naam in.").max(80),
    source: z.string().trim().max(60),
    treatment_id: z.string().uuid().nullable(),
    location_ids: z.array(z.string().uuid()).max(60),
    practitioner_mode: z.string().max(20).nullable(),
    practitioner_id: z.string().uuid().nullable(),
    language: z.enum(["nl", "en"]),
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
  treatments: ReadonlyArray<{ id: string; locations: readonly string[] }>;
  practitioners: ReadonlyArray<{ id: string; treatments: readonly string[]; locations: readonly string[] }>;
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
