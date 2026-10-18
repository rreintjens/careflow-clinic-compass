import { blockVisible, interpolate, safeMailUrl, translated, type MailBlock, type MailSituation } from "./mail";

export type MailTheme = { background: string; surface: string; heading: string; text: string; muted: string; panel: string; button: string; onPanel: string; link: string };
export type MailDocumentInput = {
  blocks: MailBlock[]; language: string; values: Record<string, string>; situation: MailSituation;
  images: Record<string, string>; practitionerPhoto?: string | null; theme: MailTheme;
};
export function escapeMailHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

/** One escaped, table-based document for the admin preview and future delivery. */
export function renderMailDocument(input: MailDocumentInput) {
  const { language, values, situation, theme } = input;
  const text = (nl: string, en: string) => escapeMailHtml(interpolate(translated(nl, en, language), values)).replace(/\n/g, "<br>");
  const visible = input.blocks.filter((block) => blockVisible(block.condition, situation));
  const firstText = visible.find((block) => block.type !== "image" && block.type !== "divider");
  const firstCard = visible.findIndex((block) => block.type === "card");
  const introEnd = firstCard < 0 ? visible.length : firstCard;
  const rendered = visible.map((block, index) => {
    const title = text(block.title_nl, block.title_en);
    const body = text(block.text_nl, block.text_en);
    const image = block.image_path ? input.images[block.image_path] : block.image;
    const imageUrl = image && safeMailUrl(image)?.startsWith("https:") ? escapeMailHtml(image) : null;
    const url = safeMailUrl(interpolate(block.url, values));
    const panel = block.type === "details" || block.type === "button";
    const ink = panel ? theme.onPanel : theme.text;
    const heading = title ? `<h2 style="margin:0 0 12px;font-size:${block === firstText ? 26 : 18}px;line-height:1.3;color:${panel ? theme.onPanel : theme.heading}">${title}</h2>` : "";
    const buttonLabel = text(block.button_nl, block.button_en);
    const buttonStyle = panel ? `display:block;text-align:center;background:${theme.button};color:${theme.onPanel};padding:14px 16px;border-radius:8px;text-decoration:none;font-size:15px` : `color:${theme.link};text-decoration:underline;font-weight:600;font-size:15px`;
    const button = buttonLabel ? `<div style="margin-top:16px">${url ? `<a href="${escapeMailHtml(url)}" target="_blank" rel="noreferrer"` : "<span"} style="${buttonStyle}">${buttonLabel}${url ? "</a>" : "</span>"}</div>` : "";
    const dots = block === firstText && title ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 18px"><tr>${Array.from({ length: 4 }, () => `<td style="padding-right:6px"><div style="width:8px;height:8px;border-radius:50%;background:${theme.button}"></div></td>`).join("")}</tr></table>` : "";
    let content = `${heading}${dots}<div style="white-space:normal;overflow-wrap:anywhere">${body}</div>${button}`;
    const inIntro = index < introEnd;
    let style = panel ? `padding:22px 24px;background:${theme.panel};color:${ink};border-radius:20px` : inIntro ? `padding:0 0 18px;color:${ink}` : block.type === "text" ? `padding:0 10px 18px;color:${theme.muted};font-size:11px` : `padding:26px 24px;background:${theme.surface};color:${ink};border-radius:20px`;
    if (block.type === "image") {
      if (!imageUrl) return { block, row: "" };
      content = `<img src="${imageUrl}" alt="${escapeMailHtml(interpolate(translated(block.title_nl, block.title_en, language), values))}" width="568" style="display:block;width:100%;height:auto;max-height:240px;object-fit:cover;border-radius:20px 20px 0 0">`;
      style = "padding:0";
    } else if (block.type === "divider") {
      content = `<hr style="border:0;border-top:1px solid ${theme.muted};margin:0">`;
      style = "padding:8px 0";
    } else if (block.type === "signature") {
      const photo = imageUrl ?? (input.practitionerPhoto && safeMailUrl(input.practitionerPhoto)?.startsWith("https:") ? escapeMailHtml(input.practitionerPhoto) : null);
      content = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${photo ? `<td width="110" style="vertical-align:middle"><img src="${photo}" alt="" width="92" height="92" style="display:block;border-radius:50%;object-fit:cover"></td>` : ""}<td style="vertical-align:middle;overflow-wrap:anywhere">${body}</td></tr></table><div style="margin-top:16px">${heading}</div>`;
    } else if (block.type === "details") {
      // The supplied detail card uses the same appointment values for both variants.
      const details = [values['duur'] && values['duur_eenheid'] ? `${values['behandeling'] ?? ""}, ${values['duur']} ${values['duur_eenheid']}` : values['behandeling'], `${values['dag'] ?? ""} ${values['tijd'] ?? ""}`.trim(), values['behandelaar']].filter((value): value is string => !!value);
      content = `${heading}<div>${details.map(escapeMailHtml).join("<br>")}</div>${body ? `<div style="margin-top:14px">${body}</div>` : ""}${button}`;
    }
    return { block, row: `<tr><td style="${style}">${content}</td></tr>${panel || !inIntro ? '<tr aria-hidden="true"><td height="10"></td></tr>' : ""}` };
  });
  const intro = rendered.slice(0, introEnd).map((item) => item.row).join("");
  const rest = rendered.slice(introEnd).map((item) => item.row).join("");
  const rows = `${intro ? `<tr><td style="background:${theme.surface};border-radius:20px;padding:26px 24px 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed">${intro}</table></td></tr><tr aria-hidden="true"><td height="18"></td></tr>` : ""}${rest}`;
  return `<!doctype html><html lang="${language === "en" ? "en" : "nl"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><style>html,body{margin:0;padding:0;background:${theme.background};color:${theme.text};font-family:'Open Sans',Arial,sans-serif;font-size:15px;line-height:1.6}*{box-sizing:border-box}a{color:${theme.link}}@media(max-width:420px){.mail-shell{padding:12px 10px!important}h2{font-size:20px!important}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}</style></head><body><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" class="mail-shell" style="padding:18px 16px 28px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:568px;table-layout:fixed"><tr><td align="center" style="padding:6px 0 18px;color:${theme.heading};font-size:22px;font-weight:600">the body clinic</td></tr>${rows}</table></td></tr></table></body></html>`;
}