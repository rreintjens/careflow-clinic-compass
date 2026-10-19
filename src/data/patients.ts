import type { Tables } from "@/integrations/supabase/types";
import { queryOptions } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { withAnswerSignals } from "./answer-sets";

function must<D>(r: { data: D | null; error: unknown }): D {
  if (r.error) throw r.error;
  return r.data as D;
}

const APPT = "id, created_at, starts_at, ends_at, status, source, booking_attribution, referral_source, new_patient, meet_link, practitioner_id, location_id, treatment_id, cancel_reason, treatment:treatments(name_nl, post_questionnaire_key), practitioner:practitioners(first_name, last_name), location:locations(name, kind)";

/** Questionnaire state of one appointment: none needed, open, or filled in. */
export function questionnaireState(postKey: string | null | undefined, sets: ReadonlyArray<{ appointment_id: string | null; questionnaire_key: string; status: string }>, apptId: string) {
  if (!postKey) return "none" as const;
  return sets.some((s) => s.appointment_id === apptId && s.questionnaire_key === postKey && s.status === "completed") ? ("done" as const) : ("open" as const);
}

/** Patient list for one local day: registrations (created that day) or appointments (starting that day). RLS scopes tenant + permission. */
export const patientListQuery = (fromIso: string, toIso: string, weekFromIso: string) =>
  queryOptions({
    queryKey: ["patient-list", fromIso],
    queryFn: async () => {
      const sel = `${APPT}, patient:patients(id, patient_number, first_name, last_name)`;
      const [created, starting, noShows] = await Promise.all([
        supabase.from("appointments").select(sel).neq("status", "hold").gte("created_at", fromIso).lt("created_at", toIso).order("created_at", { ascending: false }),
        supabase.from("appointments").select(sel).eq("status", "booked").gte("starts_at", fromIso).lt("starts_at", toIso).order("starts_at"),
        supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "no_show").gte("starts_at", weekFromIso).lt("starts_at", toIso),
      ]);
      const c = must(created), s = must(starting);
      const ids = [...new Set([...c, ...s].map((a) => a.id))];
      const sets = ids.length ? must(await supabase.from("answer_sets").select("appointment_id, questionnaire_key, status").in("appointment_id", ids)) : [];
      return { created: c, starting: s, sets, noShows: noShows.count ?? 0 };
    },
  });

/** Free-text search on name, patient number or e-mail. */
export async function searchPatients(q: string) {
  const t = q.trim();
  if (t.length < 2) return [];
  const num = /^\d+$/.test(t) ? `,patient_number.eq.${t}` : "";
  const like = t.replace(/[%,()]/g, "");
  return must(await supabase.from("patients").select("id, patient_number, first_name, last_name, email").is("deleted_at", null)
    .or(`first_name.ilike.%${like}%,last_name.ilike.%${like}%,email.ilike.%${like}%${num}`).limit(10));
}

/** Everything the record header and its five tabs need. `key` is the patient number (URLs) or, for old links, the id. */
async function loadDossier(key: string) {
  const p: Tables<"patients"> | null = /^\d+$/.test(key)
    ? must(await supabase.from("patients").select("*").eq("patient_number", Number(key)).maybeSingle())
    : must(await supabase.from("patients").select("*").eq("id", key).maybeSingle());
  if (!p) return { patient: null, appointments: [] as Array<never>, sets: [] as Array<never> };
  const [appts, sets] = await Promise.all([
    supabase.from("appointments").select(APPT).eq("patient_id", p.id).neq("status", "hold").order("starts_at", { ascending: false }),
    supabase.from("answer_sets").select("id, appointment_id, questionnaire_key, version_id, status, completed_at, created_at, updated_at, signals, answers").eq("patient_id", p.id).order("created_at", { ascending: false }),
  ]);
  return { patient: p, appointments: must(appts), sets: await withAnswerSignals(must(sets)) };
}
/** URL segment for a record: always the patient number when there is one. */
export const recordKey = (p: { id: string; patient_number?: number | string | null }) => String(p.patient_number ?? p.id);
export type Dossier = Awaited<ReturnType<typeof loadDossier>>;
export const dossierQuery = (id: string) => queryOptions({ queryKey: ["dossier", id], queryFn: () => loadDossier(id) });
