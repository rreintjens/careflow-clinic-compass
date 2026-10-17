// Security headers for every server response. In test mode the Lovable editor
// may frame the preview; once TBC_LIVE=true framing is denied entirely.
const FRAME_ANCESTORS_TEST = "'self' https://*.lovable.app https://*.lovable.dev https://lovable.dev";

export function securityHeaders(): Record<string, string> {
  const url = process.env["SUPABASE_URL"];
  const supabaseOrigin = url ? new URL(url).origin : "";
  const live = process.env["TBC_LIVE"] === "true";
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // signed storage URLs (practitioner photos) come from the backend origin
    `img-src 'self' data: blob: ${supabaseOrigin} https://*.supabase.co`,
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin} https://*.supabase.co wss://*.supabase.co https://*.lovable.cloud wss://*.lovable.cloud`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `frame-ancestors ${live ? "'none'" : FRAME_ANCESTORS_TEST}`,
  ].join("; ");
  return {
    "Content-Security-Policy": csp,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}
