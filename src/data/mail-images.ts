import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { mailImagePathSchema } from "@/domain/mail-images";

export async function mailImageBucket() {
  const { data, error } = await supabase.rpc("current_tenant_slug");
  if (error || !data) throw new Error("Geen actieve organisatie");
  return `mail-images-${data}`;
}

export const mailImagesQuery = queryOptions({
  queryKey: ["mail-images"],
  queryFn: async () => {
    const bucket = await mailImageBucket();
    const { data, error } = await supabase.storage.from(bucket).list("", { limit: 1000, sortBy: { column: "created_at", order: "desc" } });
    if (error) throw error;
    return data.filter((image) => mailImagePathSchema.safeParse(image.name).success);
  },
});

export const mailImageUrlQuery = (path: string) => queryOptions({
  queryKey: ["mail-image-url", path],
  queryFn: async () => {
    const bucket = await mailImageBucket();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(mailImagePathSchema.parse(path), 600);
    if (error) throw error;
    return data.signedUrl;
  },
  staleTime: 5 * 60 * 1000,
  refetchInterval: 5 * 60 * 1000,
});