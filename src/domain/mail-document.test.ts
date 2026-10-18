import { describe, expect, it } from "vitest";
import { escapeMailHtml, renderMailDocument } from "./mail-document";

describe("mail content escaping", () => {
  it.each([
    ['<script>alert("patient")</script>', '&lt;script&gt;alert(&quot;patient&quot;)&lt;/script&gt;'],
    ['" onerror="alert(1)', '&quot; onerror=&quot;alert(1)'],
    ["Sanne & Rob's", "Sanne &amp; Rob&#39;s"],
  ])("escapes untrusted text and attribute values", (input, expected) => {
    expect(escapeMailHtml(input)).toBe(expected);
  });
});
describe("category image block", () => {
  const theme = { background: "#fff", surface: "#f6f2ee", heading: "#2d5565", text: "#3f5a62", muted: "#8a8580", panel: "#2a5666", button: "#4d94ae", onPanel: "#fff", link: "#3a8f86" };
  const block = { id: "hero", type: "category_image", condition: "always", title_nl: "", title_en: "", text_nl: "", text_en: "", button_nl: "", button_en: "", url: "", image: "https://cdn.example/standaard.jpg" };
  const input = { language: "nl", values: {}, situation: { online: false, existingPatient: false, questionnaire: false, preparation: false }, images: {}, theme };
  it("uses the category image when there is one", () => {
    expect(renderMailDocument({ ...input, blocks: [block], categoryImage: "https://cdn.example/injectables.jpg" })).toContain("https://cdn.example/injectables.jpg");
  });
  it("falls back to the template image when the category has none", () => {
    const html = renderMailDocument({ ...input, blocks: [block], categoryImage: null });
    expect(html).toContain("https://cdn.example/standaard.jpg");
  });
  it("renders nothing when both are missing", () => {
    expect(renderMailDocument({ ...input, blocks: [{ ...block, image: "" }], categoryImage: null })).not.toContain("<img");
  });
});
