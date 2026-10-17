import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const [sections, settings, holidays] = await Promise.all([
      supabase.from("setting_sections").select("*").neq("key", "system").order("sort"),
      supabase.from("settings").select("*").neq("input_type", "hidden").order("sort"),
      supabase.from("holidays").select("*").is("deleted_at", null),
    ]);
    if (sections.error) throw sections.error;
    if (settings.error) throw settings.error;
    if (holidays.error) throw holidays.error;
    const sortedHolidays = [...holidays.data].sort((a, b) => (a.dates[0] ?? "").localeCompare(b.dates[0] ?? ""));
    return { sections: sections.data, settings: settings.data, holidays: sortedHolidays };
  },
});

export async function updateSettings(changes: Array<{ key: string; value: Json }>) {
  for (const c of changes) {
    const { error } = await supabase.from("settings").update({ value: c.value }).eq("key", c.key);
    if (error) throw error;
  }
}

export async function addHoliday(row: { name: string; dates: string[]; applies_to: string }) {
  const { error } = await supabase.from("holidays").insert(row);
  if (error) throw error;
}

export type SettingOption = { value: Json; label: string };

export function parseOptions(options: Json): SettingOption[] {
  if (!Array.isArray(options)) return [];
  return options.flatMap((o) =>
    o && typeof o === "object" && !Array.isArray(o) && typeof o["label"] === "string"
      ? [{ value: (o["value"] ?? null) as Json, label: o["label"] }]
      : [],
  );
}
