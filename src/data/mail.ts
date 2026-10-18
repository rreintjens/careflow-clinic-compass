import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const mailQuery = queryOptions({
  queryKey: ["mail-templates"],
  queryFn: async () => {
    const [templates, options] = await Promise.all([
      supabase.from("mail_templates").select("*").neq("status", "archived").order("sort").order("created_at"),
      supabase.from("option_lists").select("*").like("list_key", "mail_%").order("sort"),
    ]);
    if (templates.error) throw templates.error;
    if (options.error) throw options.error;
    return { templates: templates.data, options: options.data };
  },
});
export type MailData = Awaited<ReturnType<NonNullable<typeof mailQuery.queryFn>>>;