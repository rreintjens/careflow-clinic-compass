import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { receptionTransitions } from "@/domain/appointment-status";
import { safeQueue } from "./mailer.server";

export const changeAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ id: z.string().uuid(), expectedStatus: z.string().max(40), status: z.string().max(40), reason: z.string().max(80).nullable(), note: z.string().max(2000) }))
  .handler(async ({ data, context }) => {
    const db = context.supabase;
    if (!(await db.rpc("is_aal2")).data || !(await db.rpc("has_permission", { _perm: "agenda.appointments" })).data) throw new Error("Geen toegang.");
    const a = await db.from("appointments").select("id,status,tenant_id").eq("id", data.id).single();
    if (a.error || a.data.status !== data.expectedStatus) throw new Error("De afspraak is inmiddels gewijzigd. Open hem opnieuw.");
    if (!receptionTransitions(a.data.status).includes(data.status)) throw new Error("Deze statuswijziging hoort bij het consult of afrekenen.");
    if (data.status === "cancelled") {
      const reason = await db.from("option_lists").select("value").eq("list_key", "cancel_reason").eq("value", data.reason ?? "").maybeSingle();
      if (!reason.data) throw new Error("Kies een annuleringsreden.");
    }
    const r = await db.from("appointments").update({ status: data.status, cancel_reason: data.status === "cancelled" ? data.reason : null, reception_note: data.note || null }).eq("id", data.id).eq("status", data.expectedStatus).select("id");
    if (r.error) throw new Error(r.error.message);
    if (!r.data.length) throw new Error("De afspraak is inmiddels gewijzigd.");
    if (data.status === "cancelled" || data.status === "no_show") {
      const { admin } = await import("./booking.server");
      await safeQueue(await admin(), data.id, data.status === "cancelled" ? "cancelled" : "no_show", { dedupe: `${data.status}-${data.id}-${Date.now()}` });
    }
    return { ok: true };
  });