import { createServerFn } from "@tanstack/react-start";
import { inspectMailImage, mailImageUploadSchema } from "@/domain/mail-images";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const uploadMailImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mailImageUploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    if ((context.claims as { aal?: string }).aal !== "aal2") throw new Error("Forbidden");
    const permission = await context.supabase.rpc("has_permission", { _perm: "emails.templates" });
    if (permission.error || !permission.data) throw new Error("Forbidden");
    const tenant = await context.supabase.rpc("current_tenant_slug");
    if (tenant.error || !tenant.data) throw new Error("Geen actieve organisatie");
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0)); }
    catch { throw new Error("Kies een geldige JPG- of PNG-afbeelding."); }
    const kind = inspectMailImage(bytes);
    const path = `${crypto.randomUUID()}.${kind.extension}`;
    const result = await context.supabase.storage.from(`mail-images-${tenant.data}`).upload(path, bytes, { contentType: kind.contentType, upsert: false });
    if (result.error) throw new Error("Afbeelding uploaden is niet gelukt.");
    return { path };
  });