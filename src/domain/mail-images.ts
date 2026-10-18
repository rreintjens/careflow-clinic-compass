import { z } from "zod";

export const mailImagePathSchema = z.string().regex(/^[0-9a-f-]{36}\.(jpg|png)$/);
export const mailImageUploadSchema = z.object({ content: z.string().min(1).max(7_000_000) });

/** Inspect bytes rather than trusting a filename or browser-provided MIME type. */
export function inspectMailImage(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("Kies een JPG of PNG van maximaal 5 MB.");
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => bytes[i] === byte)) return { extension: "png", contentType: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: "jpg", contentType: "image/jpeg" };
  throw new Error("Kies een geldige JPG- of PNG-afbeelding.");
}