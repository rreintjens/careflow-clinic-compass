import { describe, expect, it } from "vitest";
import { escapeMailHtml } from "./mail-document";

describe("mail content escaping", () => {
  it.each([
    ['<script>alert("patient")</script>', '&lt;script&gt;alert(&quot;patient&quot;)&lt;/script&gt;'],
    ['" onerror="alert(1)', '&quot; onerror=&quot;alert(1)'],
    ["Sanne & Rob's", "Sanne &amp; Rob&#39;s"],
  ])("escapes untrusted text and attribute values", (input, expected) => {
    expect(escapeMailHtml(input)).toBe(expected);
  });
});