import { createFileRoute } from "@tanstack/react-router";

import { admin } from "@/data/booking.server";
import { runEkisExport } from "@/data/integrations.server";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

/**
 * Daily eKis export, called by the scheduler at 06:00. Only the cron bearer token opens this route;
 * each brand with the export on gets one file with everyone who arrived since the previous run.
 */
async function exportAll() {
  const db = await admin();
  const { data: tenants, error } = await db.from("tenants").select("id, slug, ekis_export_enabled").eq("ekis_export_enabled", true);
  if (error) return Response.json({ error: "export_failed" }, { status: 500 });
  const runs: Array<Record<string, unknown>> = [];
  for (const t of tenants ?? []) {
    try {
      const r = await runEkisExport(t.id, "schedule");
      runs.push({ tenant: t.slug, status: "ok", patients: r.patients, answer_sets: r.answerSets });
    } catch {
      runs.push({ tenant: t.slug, status: "failed" });
    }
  }
  return Response.json({ ran_at: new Date().toISOString(), runs }, { headers: { "cache-control": "no-store" } });
}

export const Route = createFileRoute("/api/public/ekis-export")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        return exportAll();
      },
      GET: async ({ request }) => {
        const denied = await authenticateCronRequest(request);
        if (denied) return denied;
        return exportAll();
      },
    },
  },
});
