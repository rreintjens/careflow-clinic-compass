import { createFileRoute } from "@tanstack/react-router";
import { statsCredential } from '@/domain/stats-access';

import { logStatsRequest, statsSummary, tenantByStatsKey } from "@/data/integrations.server";

/**
 * Statistics API for the management dashboard and Power BI: one key per connection, totals only,
 * never a row about one person. A wrong or missing key gets the same short answer, so the route
 * cannot be used to probe which keys exist.
 */
async function handle(request: Request) {
  const url = new URL(request.url);
  const key = statsCredential(request);
  const days = Number(url.searchParams.get("days") ?? "30");
  const tenant = key ? await tenantByStatsKey(key) : null;
  if (!tenant) return Response.json({ error: "ongeldige sleutel" }, { status: 403, headers: { "cache-control": "no-store" } });
  try {
    const summary = await statsSummary(tenant, Number.isFinite(days) ? days : 30);
    await logStatsRequest(tenant.id, "stats", true);
    return Response.json(summary, { headers: { "cache-control": "no-store" } });
  } catch {
    await logStatsRequest(tenant.id, "stats", false);
    return Response.json({ error: "opvragen is niet gelukt" }, { status: 500, headers: { "cache-control": "no-store" } });
  }
}

export const Route = createFileRoute("/api/public/stats")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
    },
  },
});
