import { describe, expect, it } from "vitest";
import { inspectMailImage, mailImagePathSchema } from "./mail-images";

describe("private mail image validation", () => {
  it.each([
    { bytes: [137, 80, 78, 71, 13, 10, 26, 10], extension: "png", contentType: "image/png" },
    { bytes: [255, 216, 255, 224], extension: "jpg", contentType: "image/jpeg" },
  ])("detects $extension from content", ({ bytes, extension, contentType }) => {
    expect(inspectMailImage(new Uint8Array(bytes))).toEqual({ extension, contentType });
  });
  it.each([[], [60, 115, 118, 103, 62], [71, 73, 70, 56]])("rejects unsupported content %j", (bytes) => {
    expect(() => inspectMailImage(new Uint8Array(bytes))).toThrow();
  });
  it("rejects files larger than 5 MB", () => {
    const bytes = new Uint8Array(5 * 1024 * 1024 + 1); bytes.set([255, 216, 255]);
    expect(() => inspectMailImage(bytes)).toThrow();
  });
  it.each(["../photo.jpg", "other-tenant/photo.png", "https://example.test/photo.jpg"])("rejects a non-local object path %s", (path) => {
    expect(mailImagePathSchema.safeParse(path).success).toBe(false);
  });
});