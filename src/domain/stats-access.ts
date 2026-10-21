/** Credentials belong in headers, never in shareable URLs or their access logs. */
export function statsCredential(request: Request): string | null {
  if (new URL(request.url).searchParams.has('key')) return null;
  const key = request.headers.get('x-api-key')?.trim();
  return key && key.length <= 200 ? key : null;
}