import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Fixed screen texts live in option lists, so they can be changed without a code change. */
export const uiTextsQuery = (listKey: string) =>
  queryOptions({
    queryKey: ["ui-texts", listKey],
    queryFn: async () => {
      const { data, error } = await supabase.from("option_lists").select("value, label_nl, label_en, sort").eq("list_key", listKey).order("sort");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.value, r.label_nl]));
    },
    staleTime: 300_000,
  });

/** A text that is missing from the list shows its own key, so the gap is visible instead of silent. */
export const textOf = (texts: ReadonlyMap<string, string>, key: string) => texts.get(key) ?? key;
