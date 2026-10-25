/** Why an uploaded SVG icon is refused, or null. Icons are line drawings: no scripts, events, links or embedded content. */
export function svgIconError(svg: string): string | null {
  if (svg.length > 60_000) return "Het bestand is te groot (maximaal 60 kB)";
  if (!/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg)) return "Dit is geen SVG-bestand";
  if (/<!DOCTYPE|<!ENTITY|<script|<foreignObject|<iframe|<object|<embed|<image|<use|<style|\bon[a-z]+\s*=|javascript:|(?:xlink:)?href\s*=|url\s*\(|@import/i.test(svg))
    return "Dit SVG-bestand bevat onderdelen die niet zijn toegestaan; gebruik een eenvoudige lijntekening";
  return null;
}
