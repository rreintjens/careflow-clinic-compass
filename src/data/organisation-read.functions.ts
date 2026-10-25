import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** One browser round trip; all reads still use the caller's tenant-scoped RLS. */
export const getOrganisation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    let active = 0;
    const waiting: Array<() => void> = [];
    const read = async <T,>(query: () => PromiseLike<T>): Promise<T> => {
      if (active >= 6) await new Promise<void>(resolve => waiting.push(resolve));
      else active++;
      try { return await query(); }
      finally {
        const next = waiting.shift();
        if (next) next();
        else active--;
      }
    };
    const must = <T,>(result: { data: T | null; error: unknown }): T => {
      if (result.error) throw result.error;
      if (result.data === null) throw new Error("Gegevens ontbreken.");
      return result.data;
    };
    const [
      options, roles, languages, locations, hours, rooms, equipment, dayLocs, kinds, types, categories, treatments,
      catLinks, treatRoles, treatLocs, reqs, practitioners, pracLangs, pracLocs, pracTreats, menuRoots, customIcons, menuSettings,
    ] = await Promise.all([
      read(() => context.supabase.from("option_lists").select("*").order("sort")),
      read(() => context.supabase.from("practitioner_roles").select("*").order("sort")),
      read(() => context.supabase.from("languages").select("*").order("sort")),
      read(() => context.supabase.from("locations").select("*").order("sort")),
      read(() => context.supabase.from("location_hours").select("*")),
      read(() => context.supabase.from("rooms").select("*").order("sort")),
      read(() => context.supabase.from("equipment").select("*").order("sort")),
      read(() => context.supabase.from("equipment_schedule").select("*")),
      read(() => context.supabase.from("equipment_kinds").select("*").order("sort")),
      read(() => context.supabase.from("equipment_types").select("*").order("brand").order("type")),
      read(() => context.supabase.from("treatment_categories").select("*").order("sort")),
      read(() => context.supabase.from("treatments").select("*").order("name_nl")),
      read(() => context.supabase.from("treatment_category_links").select("*").order("sort")),
      read(() => context.supabase.from("treatment_practitioner_roles").select("*")),
      read(() => context.supabase.from("treatment_locations").select("*")),
      read(() => context.supabase.from("treatment_requirements").select("*").order("sort")),
      read(() => context.supabase.from("practitioners").select("*").order("sort")),
      read(() => context.supabase.from("practitioner_languages").select("*")),
      read(() => context.supabase.from("practitioner_locations").select("*")),
      read(() => context.supabase.from("practitioner_treatments").select("*")),
      read(() => context.supabase.from("treatment_menu_root").select("treatment_id, sort")),
      read(() => context.supabase.from("custom_icons").select("id, name, svg").order("created_at")),
      read(() => context.supabase.from("settings").select("key, value").in("key", ["menu_max_depth", "menu_default_icon"])),
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
      menuRoots: must(menuRoots),
      customIcons: must(customIcons),
      menuMaxDepth: Number(must(menuSettings).find((x) => x.key === "menu_max_depth")?.value ?? 3) || 3,
      menuDefaultIcon: (() => { const v = must(menuSettings).find((x) => x.key === "menu_default_icon")?.value; return typeof v === "string" ? v : "ui:blad"; })(),
    };
  });
