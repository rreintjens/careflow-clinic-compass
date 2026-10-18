/**
 * Saving a booking link (staff, MFA + booking_links.manage) and reading one as a patient.
 * The save validates every choice against the tenant's own rows, so a link can never point at
 * another brand's treatment, location or practitioner.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bookingLinkSchema, linkProblem, linkPractitioners, uniqueSlug, type LinkCatalog } from "@/domain/booking-links";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { admin } from "./booking.server";

type Ctx = { supabase: import("@supabase/supabase-js").SupabaseClient; claims: unknown };

/** Catalogue view for the pure rules, built from rows the caller is allowed to see. */
async function catalogOf(supabase: Ctx["supabase"]): Promise<LinkCatalog> {
  const [treatments, locations, pracTreat, pracLoc] = await Promise.all([
    supabase.from("treatments").select("id, treatment_locations:location_ids").select("id, location_ids").eq("status", "active"),
    supabase.from("locations").select("id").eq("status", "open"),
    supabase.from("practitioner_treatments").select("practitioner_id, treatment_id, excluded_location_ids"),
    supabase.from("practitioner_locations").select("practitioner_id, location_id"),
  ]);
  const open = new Set((locations.data ?? []).map((l) => l.id));
  const at = new Map<string, string[]>();
  for (const row of pracLoc.data ?? []) (at.get(row.practitioner_id) ?? at.set(row.practitioner_id, []).get(row.practitioner_id)!).push(row.location_id);
  const does = new Map<string, string[]>();
  for (const row of pracTreat.data ?? []) (does.get(row.practitioner_id) ?? does.set(row.practitioner_id, []).get(row.practitioner_id)!).push(row.treatment_id);
  return {
    treatments: (treatments.data ?? []).map((t) => ({ id: t.id, locations: (t.location_ids ?? []).filter((l) => open.has(l)) })),
    practitioners: [...at.keys()].map((id) => ({ id, treatments: does.get(id) ?? [], locations: at.get(id) ?? [] })),
  };
}

export const saveBookingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingLinkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx;
    if ((ctx.claims as { aal?: string }).aal !== "aal2") throw new Error("Forbidden");
    const { data: allowed, error: permissionError } = await ctx.supabase.rpc("has_permission", { _perm: "booking_links.manage" });
    if (permissionError || !allowed) throw new Error("Forbidden");

    const options = await ctx.supabase.from("option_lists").select("value").eq("list_key", "practitioner_choice");
    if (options.error) throw new Error("Invalid configuration");
    const modes = new Set((options.data ?? []).map((o) => o.value));
    if (data.practitioner_mode && !modes.has(data.practitioner_mode)) throw new Error("Invalid selection");

    const catalog = await catalogOf(ctx.supabase);
    if (data.treatment_id && !catalog.treatments.some((t) => t.id === data.treatment_id)) throw new Error("Forbidden");
    if (data.practitioner_id && !catalog.practitioners.some((p) => p.id === data.practitioner_id)) throw new Error("Forbidden");
    const problem = linkProblem(catalog, data);
    if (problem === "no_location") throw new Error("Kies eerst minstens één locatie waar deze behandeling dit doet.");
    if (problem === "no_practitioner") throw new Error("Kies welke behandelaar de patiënt krijgt.");
    if (problem === "practitioner_unavailable") throw new Error("Deze behandelaar doet dit niet op de gekozen locatie.");

    const taken = (await ctx.supabase.from("booking_links").select("slug, id").eq("status", "active")).data ?? [];
    const used = taken.filter((r) => r.id !== data.id).map((r) => r.slug);
    const slug = data.slug.trim() || uniqueSlug(used, data.name);
    if (used.includes(slug)) throw new Error("Die linknaam is al in gebruik.");
    const { id, ...values } = data;
    const result = id
      ? await ctx.supabase.from("booking_links").update({ ...values, slug }).eq("id", id).select("id").single()
      : await ctx.supabase.from("booking_links").insert({ ...values, slug }).select("id").single();
    if (result.error) throw new Error("Opslaan is niet gelukt.");
    return { id: result.data.id, slug };
  });

/** What the patient-facing booking flow needs to know about one link. Display data only. */
export const getBookingLink = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), link: z.string().max(60) }))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: tenant } = await db.from("tenants").select("id, slug, display_name, time_zone, default_language, extra_languages, test_mode, booking_domains");
    const host = new Set((tenant ?? []).flatMap((t) => t.booking_domains));
    void host;
    return null;
  });
