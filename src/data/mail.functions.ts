import { createServerFn } from "@tanstack/react-start";
import { mailTemplateSchema } from "@/domain/mail";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const saveMailTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mailTemplateSchema.parse(input))
  .handler(async ({ data, context }) => {
    if ((context.claims as { aal?: string }).aal !== "aal2") throw new Error("Forbidden");
    const permission = await context.supabase.rpc("has_permission", { _perm: "emails.templates" });
    if (permission.error || !permission.data) throw new Error("Forbidden");
    const options = await context.supabase.from("option_lists").select("list_key,value").in("list_key", ["mail_moment", "mail_block_type", "mail_condition"]);
    if (options.error) throw new Error("Invalid configuration");
    const has = (key: string, value: string) => options.data.some((o) => o.list_key === key && o.value === value);
    if (!has("mail_moment", data.moment) || data.blocks.some((b) => !has("mail_block_type", b.type) || !has("mail_condition", b.condition))) throw new Error("Invalid selection");
    const paths = [...new Set(data.blocks.map((b) => b.image_path).filter((p): p is string => !!p))];
    if (paths.length) {
      const tenant = await context.supabase.rpc("current_tenant_slug");
      if (tenant.error || !tenant.data) throw new Error("Forbidden");
      for (const path of paths) {
        const signed = await context.supabase.storage.from(`mail-images-${tenant.data}`).createSignedUrl(path, 600);
        if (signed.error || !signed.data) throw new Error("Afbeelding is niet beschikbaar voor deze organisatie.");
      }
    }
    for (const [table, id] of [["treatments", data.treatment_id], ["treatment_categories", data.category_id]] as const) {
      if (!id) continue;
      const row = await context.supabase.from(table).select("id").eq("id", id).maybeSingle();
      if (row.error || !row.data) throw new Error("Forbidden");
    }
    const { id, ...values } = data;
    const query = id ? context.supabase.from("mail_templates").update(values).eq("id", id) : context.supabase.from("mail_templates").insert(values);
    const result = await query.select("id").single();
    if (result.error) throw new Error("Opslaan is niet gelukt. Controleer of voor dit moment al een sjabloon bestaat.");
    return result.data;
  });