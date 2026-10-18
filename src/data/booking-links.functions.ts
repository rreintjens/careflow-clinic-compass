/**
 * Saving a booking link (staff, MFA + booking_links.manage) and reading one as a patient.
 * The save validates every choice against the tenant's own rows, so a link can never point at
 * another brand's treatment, location or practitioner.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bookingLinkSchema, linkProblem, uniqueSlug, type LinkCatalog } from "@/domain/booking-links";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { admin, resolveTenant } from "./booking.server";

type Supabase = import("@supabase/supabase-js").SupabaseClient;
type Ctx = { supabase: Supabase; claims: unknown };

/** Catalogue view for the pure rules, built from rows the caller is allowed to see. */
async function catalogOf(supabase: Supabase): Promise<LinkCatalog> {
  const [treatments, locations, treatLoc, pracTreat, pracLoc] = await Promise.all([
    supabase.from("treatments").select("id").eq("status", "active"),
    supabase.from("locations").select("id").eq("status", "open"),
    supabase.from("treatment_locations").select("treatment_id, location_id"),
    supabase.from("practitioner_treatments").select("practitioner_id, treatment_id, excluded_location_ids"),
    supabase.from("practitioner_locations").select("practitioner_id, location_id"),
  ]);
  const open = new Set((locations.data ?? []).map((l) => l.id));
  const offers = new Map<string, string[]>();
  for (const row of treatLoc.data ?? []) {
    if (!open.has(row.location_id)) continue;
    const list = offers.get(row.treatment_id);
    if (list) list.push(row.location_id);
    else offers.set(row.treatment_id, [row.location_id]);
  }
  const at = new Map<string, string[]>();
  for (const row of pracLoc.data ?? []) {
    if (!open.has(row.location_id)) continue;
    const list = at.get(row.practitioner_id);
    if (list) list.push(row.location_id);
    else at.set(row.practitioner_id, [row.location_id]);
  }
  const does = new Map<string, string[]>();
  for (const row of pracTreat.data ?? []) {
    const list = does.get(row.practitioner_id);
    if (list) list.push(row.treatment_id);
    else does.set(row.practitioner_id, [row.treatment_id]);
  }
  return {
    treatments: (treatments.data ?? []).map((t) => ({ id: t.id, locations: offers.get(t.id) ?? [] })),
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

    const taken = (await ctx.supabase.from("booking_links").select("slug, id")).data ?? [];
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

/**
 * One booking link as the patient flow sees it: which steps are answered in advance and which
 * source every booking through this link carries. Display data only, no internal names.
 */
export const getBookingLink = createServerFn({ method: "GET" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), link: z.string().max(60) }))
  .handler(async ({ data }) => {
    const tenant = await resolveTenant(data.merk);
    if (!tenant) return { found: false as const };
    const db = await admin();
    const row = (await db.from("booking_links").select("*").eq("tenant_id", tenant.id).eq("slug", data.link).eq("status", "active").maybeSingle()).data;
    if (!row) return { found: false as const };
    const [treatment, locationIds, practitioner] = await Promise.all([
      row.treatment_id ? db.from("treatments").select("id, name_nl, name_en, practitioner_choice, status").eq("tenant_id", tenant.id).eq("id", row.treatment_id).maybeSingle() : Promise.resolve(null),
      row.location_ids.length
        ? db.from("locations").select("id, name, kind, status").eq("tenant_id", tenant.id).in("id", row.location_ids).eq("status", "open")
        : Promise.resolve({ data: [] as Array<{ id: string }> }),
      row.practitioner_id ? db.from("practitioners").select("id, first_name, last_name, status").eq("tenant_id", tenant.id).eq("id", row.practitioner_id).maybeSingle() : Promise.resolve(null),
    ]);
    const treatmentRow = treatment && "data" in treatment ? treatment.data : null;
    const locations = ((locationIds && "data" in locationIds ? locationIds.data : []) ?? []) as Array<{ id: string; name: string; kind: string }>;
    const practitionerRow = practitioner && "data" in practitioner ? practitioner.data : null;
    if (row.treatment_id && (!treatmentRow || treatmentRow.status !== "active")) return { found: false as const };
    if (row.practitioner_mode === "fixed" && (!practitionerRow || practitionerRow.status !== "active")) return { found: false as const };
    const allowed = locations.map((l) => l.id);
    return {
      found: true as const,
      link: {
        slug: row.slug,
        name: row.name,
        source: row.source,
        language: row.language,
        treatmentId: row.treatment_id,
        locationIds: allowed,
        practitionerMode: row.practitioner_mode,
        practitionerId: row.practitioner_mode === "fixed" ? row.practitioner_id : null,
      },
    };
  });
