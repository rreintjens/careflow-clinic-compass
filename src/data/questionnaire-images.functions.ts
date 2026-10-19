/** Uploads for questionnaire images (e.g. measure_with_image); stored in a public per-tenant bucket so anonymous patients see them. */
import { createServerFn } from "@tanstack/react-start";

import { inspectMailImage, mailImageUploadSchema } from "@/domain/mail-images";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { admin } from "./booking.server";

export const uploadQuestionnaireImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => mailImageUploadSchema.parse(input))
  .handler(async ({ data, context }) => {
    if (!(await context.supabase.rpc("is_aal2")).data) throw new Error("Forbidden");
    const permission = await context.supabase.rpc("has_permission", { _perm: "questionnaires.manage" });
    if (permission.error || !permission.data) throw new Error("Forbidden");
    const tenant = await context.supabase.rpc("current_tenant_slug");
    if (tenant.error || !tenant.data) throw new Error("Geen actieve organisatie");
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.content), (c) => c.charCodeAt(0)); }
    catch { throw new Error("Kies een geldige JPG- of PNG-afbeelding."); }
    const kind = inspectMailImage(bytes);
    const bucket = `questionnaire-images-${tenant.data}`;
    const db = await admin();
    const created = await db.storage.createBucket(bucket, { public: true });
    if (created.error && !/already exists/i.test(created.error.message)) throw new Error("Afbeelding uploaden is niet gelukt.");
    const path = `${crypto.randomUUID()}.${kind.extension}`;
    const result = await db.storage.from(bucket).upload(path, bytes, { contentType: kind.contentType, upsert: false });
    if (result.error) throw new Error("Afbeelding uploaden is niet gelukt.");
    return { url: `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}` };
  });
