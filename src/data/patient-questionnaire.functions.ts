/**
 * Medical questionnaire after booking, reached via the appointment's private link (manage token).
 * Runs with the admin client after resolving the brand and the token; returns only what the screens show.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { collectSignals, makeCtx, prefillAnswers, type Answers, type FlowFile, type QuestionnaireDef } from "@/domain/questionnaire/engine";
import { admin, localParts, resolveTenant } from "./booking.server";

/** Answers can be changed until 24 hours before the consult; after that the doctor discusses them. */
const editable = (startsAt: string) => Date.parse(startsAt) - Date.now() > 24 * 3_600_000;

async function load(merk: string | undefined, token: string) {
  const tenant = await resolveTenant(merk);
  if (!tenant) return null;
  const db = await admin();
  const appt = (await db.from("appointments").select("id, patient_id, treatment_id, practitioner_id, status, starts_at").eq("tenant_id", tenant.id).eq("manage_token", token).maybeSingle()).data;
  if (!appt || appt.status !== "booked" || !appt.patient_id) return null;
  const t = (await db.from("treatments").select("post_questionnaire_key, pre_questionnaire_key").eq("id", appt.treatment_id).single()).data;
  if (!t?.post_questionnaire_key) return null;
  const q = (await db.from("questionnaires").select("id, key, flow_id").eq("tenant_id", tenant.id).eq("key", t.post_questionnaire_key).maybeSingle()).data;
  if (!q) return null;
  const [v, f] = await Promise.all([
    db.from("questionnaire_versions").select("id, definition").eq("questionnaire_id", q.id).eq("status", "published").maybeSingle(),
    db.from("questionnaire_flows").select("document").eq("id", q.flow_id).maybeSingle(),
  ]);
  if (!v.data) return null;
  return { tenant, db, appt, q, version: v.data, rawFlow: f.data?.document ?? {}, flow: (f.data?.document ?? {}) as unknown as FlowFile, triageKey: t.pre_questionnaire_key };
}

export const getPatientQuestionnaire = createServerFn({ method: "POST" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), token: z.string().uuid() }))
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    const ui = ((await (await admin()).from("option_lists").select("list_key, value, label_nl, label_en").in("list_key", ["booking_ui", "questionnaire_ui"])).data ?? []);
    if (!x) return { found: false as const, ui };
    const { db, appt, q, tenant } = x;
    const [sets, patient, pr] = await Promise.all([
      db.from("answer_sets").select("questionnaire_key, answers, status, completed_at").eq("appointment_id", appt.id),
      db.from("patients").select("first_name").eq("id", appt.patient_id ?? "").single(),
      db.from("practitioners").select("first_name").eq("id", appt.practitioner_id).single(),
    ]);
    const own = sets.data?.find((r) => r.questionnaire_key === q.key);
    const triage = sets.data?.find((r) => r.questionnaire_key === x.triageKey);
    const def = x.version.definition as unknown as QuestionnaireDef;
    const prefill = triage ? prefillAnswers(def, triage.answers as Answers) : {};
    const start = new Date(appt.starts_at);
    const dag = start.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: tenant.time_zone });
    const tijd = start.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: tenant.time_zone });
    return {
      found: true as const, ui,
      definition: x.version.definition, flow: x.rawFlow, status: own?.status ?? "new", completedAt: own?.completed_at ?? null, canEdit: editable(appt.starts_at),
      answers: JSON.parse(JSON.stringify({ ...prefill, ...((own?.answers ?? {}) as Answers) })) as import("@/integrations/supabase/types").Json,
      vars: { voornaam: patient.data?.first_name ?? "", behandelaar_voornaam: pr.data?.first_name ?? "", dag, tijd },
    };
  });

/** Autosaves answers; with `complete` the set is closed and doctor signals are computed by the engine. */
export const savePatientQuestionnaire = createServerFn({ method: "POST" })
  .inputValidator(z.object({ merk: z.string().max(60).optional(), token: z.string().uuid(), answers: z.record(z.string(), z.unknown()), complete: z.boolean() }))
  .handler(async ({ data }) => {
    const x = await load(data.merk, data.token);
    if (!x) return { ok: false };
    const { db, appt, q, tenant } = x;
    const existing = (await db.from("answer_sets").select("id, status").eq("appointment_id", appt.id).eq("questionnaire_key", q.key).maybeSingle()).data;
    if (existing?.status === "completed" && !editable(appt.starts_at)) return { ok: false };
    const today = localParts(new Date(), tenant.time_zone).date;
    const signals = data.complete ? collectSignals(x.version.definition as unknown as QuestionnaireDef, makeCtx(x.flow, data.answers as Answers, today)) : [];
    const row = {
      answers: data.answers as never, signals: signals as never, version_id: x.version.id,
      status: data.complete ? "completed" : "in_progress", completed_at: data.complete ? new Date().toISOString() : null,
    };
    const r = existing
      ? await db.from("answer_sets").update(row).eq("id", existing.id)
      : await db.from("answer_sets").insert({ ...row, tenant_id: tenant.id, patient_id: appt.patient_id ?? "", appointment_id: appt.id, questionnaire_key: q.key });
    return { ok: !r.error };
  });
