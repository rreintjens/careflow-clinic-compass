/**
 * Saving a booking link (staff, MFA + booking_links.manage) and reading one as a patient.
 * The save validates every choice against the tenant's own rows, so a link can never point at
 * another brand's treatment, location or practitioner.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { bookingLinkSchema, uniqueSlug } from "@/domain/booking-links";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { randomLinkHash } from "@/domain/attribution";
import { admin, resolveTenant } from "./booking.server";

import { scopeCatalog, resolveLinkScope } from "./booking-link-scope.server";
import { scopeTreatments, scopePractitioners } from "@/domain/booking-links";

export const saveBookingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bookingLinkSchema.parse(input))
  .handler(async ({ data, context }) => {
    const ctx = context;
    if (!(await ctx.supabase.rpc("is_aal2")).data) throw new Error("Forbidden");
    const { data: allowed, error: permissionError } = await ctx.supabase.rpc("has_permission", { _perm: "booking_links.manage" });
    if (permissionError || !allowed) throw new Error("Forbidden");

    const options = await ctx.supabase.from("option_lists").select("value").eq("list_key", "practitioner_choice");
    if (options.error) throw new Error("Invalid configuration");
    const modes = new Set((options.data ?? []).map((o) => o.value));
    if (data.practitioner_mode && !modes.has(data.practitioner_mode)) throw new Error("Invalid selection");

    const tenantId = (await ctx.supabase.rpc("current_tenant")).data;
    if (!tenantId) throw new Error("Geen merk gekozen");
    const catalog = await scopeCatalog(ctx.supabase,tenantId);
    if (data.treatment_ids.some(id => !catalog.treatments.some(t => t.id===id)) || data.category_ids.some(id => !catalog.categories?.some(c => c.id===id)) || data.location_ids.some(id => !catalog.treatments.some(t => t.locations.includes(id)))) throw new Error("Ongeldige selectie");
    if (data.practitioner_scope === "selected" && (!data.practitioner_ids.length || data.practitioner_ids.some(id => !catalog.practitioners.some(p => p.id===id)))) throw new Error("Kies minstens één behandelaar");
    if (!scopeTreatments(catalog,data).some(id => scopePractitioners(catalog,data,id).length)) throw new Error("Geen behandeling is boekbaar met deze behandelaars en locaties");
    const [channel,place,campaign]=await Promise.all([ctx.supabase.from("booking_channels").select("*").eq("tenant_id",tenantId).eq("id",data.channel_id??"").maybeSingle(),ctx.supabase.from("booking_places").select("*").eq("tenant_id",tenantId).eq("id",data.place_id??"").maybeSingle(),ctx.supabase.from("booking_campaigns").select("*").eq("tenant_id",tenantId).eq("id",data.campaign_id??"").maybeSingle()]);
    if(!channel.data || !place.data || place.data.channel_id!==channel.data.id || !campaign.data) throw new Error("Kies een kanaal, plek en campagne");
    const taken=(await ctx.supabase.from("booking_links").select("slug,hash,id").eq("tenant_id",tenantId)).data??[];
    let hash=data.id?taken.find(r=>r.id===data.id)?.hash:undefined;
    if(!hash) { for(let attempt=0;attempt<100;attempt++){const candidate=randomLinkHash();if(!taken.some(r=>r.hash===candidate||r.slug===candidate)){hash=candidate;break;}} }
    if(!hash) throw new Error("Een linkcode maken is niet gelukt");
    const slug=data.id?taken.find(r=>r.id===data.id)?.slug??hash:hash;
    const { id, ...values } = data;
    const result = id
      ? await ctx.supabase.from("booking_links").update({ ...values, slug,hash,source:channel.data.name }).eq("id", id).select("id").single()
      : await ctx.supabase.from("booking_links").insert({ ...values, slug,hash,source:channel.data.name }).select("id").single();
    if (result.error) throw new Error("Opslaan is niet gelukt.");
    return { id: result.data.id, slug,hash };
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
    const scope = await resolveLinkScope(db,tenant.id,data.link);
    if (!scope || !scope.treatmentIds.length) return {found:false as const};
    const row = scope.row;
    return {found:true as const,link:{slug:row.hash,name:row.name,source:row.source,language:row.language,startScreenMode:row.start_screen_mode,startScreen:row.start_screen,treatmentId:scope.treatmentIds.length===1?scope.treatmentIds[0]??null:null,treatmentIds:scope.treatmentIds,locationIds:row.location_ids,practitionerMode:row.practitioner_mode,practitionerId:row.practitioner_scope==="selected" && row.practitioner_ids.length===1?row.practitioner_ids[0]??null:null,practitionerIds:row.practitioner_scope==="selected"?row.practitioner_ids:null,showPatientLogin:row.show_patient_login??true}};
  });
