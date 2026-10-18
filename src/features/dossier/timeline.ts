import type { Dossier } from "@/data/patients";
import type { Database } from "@/integrations/supabase/types";
import { measurementWithBmi } from "@/domain/measurements";

export type TimelineKind = "appointments" | "questionnaires" | "contact" | "treatment" | "system";
export interface TimelineEvent { at: string; kind: TimelineKind; icon: string; title: string; body: string; who: string; meet?: string | null }

const STATUS: Record<string, string> = { booked: "", cancelled: " · geannuleerd", no_show: " · niet verschenen", completed: " · afgerond" };

/** Events derived from stored rows, newest first. */
export function buildTimeline(d: Dossier, consults: ReadonlyArray<Database["public"]["Tables"]["consult_notes"]["Row"]> = [], measurements: ReadonlyArray<Database["public"]["Tables"]["measurements"]["Row"]> = []): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const a of d.appointments) {
    const online = a.location?.kind === "online";
    const prac = a.practitioner ? `${a.practitioner.first_name} ${a.practitioner.last_name}` : "";
    const name = a.treatment?.name_nl ?? "";
    out.push({ at: a.starts_at, kind: "appointments", icon: online ? "videogesprek" : "kalender", title: `${name}${online ? ", online" : `, ${a.location?.name ?? ""}`}${STATUS[a.status] ?? ""}`, body: `Met ${prac}.${a.cancel_reason ? ` Reden: ${a.cancel_reason}.` : ""}`, who: "Afspraak", meet: a.status === "booked" && online ? a.meet_link : null });
    out.push({ at: a.created_at, kind: "appointments", icon: "kalender", title: "Afspraak geboekt", body: `${name}${online ? ", online" : ""}, ${new Date(a.starts_at).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}. ${prac}${a.new_patient ? "; nieuwe patiënt" : ""}.`, who: a.source === "agenda" ? "Medewerker, via de agenda" : `Patiënt${a.referral_source ? `, via ${a.referral_source}` : ""}` });
  }
  for (const s of d.sets) {
    if (s.status !== "completed" || !s.completed_at) continue;
    const n = Array.isArray(s.signals) ? s.signals.length : 0;
    const count = s.answers && typeof s.answers === "object" ? Object.keys(s.answers).length : 0;
    out.push({ at: s.completed_at, kind: "questionnaires", icon: "document", title: s.questionnaire_key === "triage" ? "Triage doorlopen: groen" : "Medische vragenlijst ingevuld", body: `${count} antwoorden${n ? `; ${n} ${n === 1 ? "signaal" : "signalen"} voor de arts` : ""}.`, who: "Patiënt" });
  }
  for (const n of consults) {
    if (n.status !== "final" || n.appointment_id !== null) continue;
    out.push({ at: n.occurred_at ?? n.created_at, kind: "appointments", icon: "document", title: "Consult vastgelegd", body: [n.time_and_duration, n.reason, n.subjective, n.objective, n.evaluation, n.plan].filter(Boolean).join(" · "), who: "Behandelaar" });
  }
  for (const m of measurements) {
    const bmi = measurementWithBmi(m, measurements).bmi;
    const body = [m.weight_kg !== null ? `${m.weight_kg} kg` : null, bmi !== null ? `BMI ${bmi.toFixed(1).replace(".", ",")}` : null, m.waist_cm !== null ? `Buikomvang ${m.waist_cm} cm` : null, m.bp_systolic !== null ? `Bloeddruk ${m.bp_systolic}/${m.bp_diastolic ?? "–"}` : null, m.pulse !== null ? `Pols ${m.pulse}` : null].filter(Boolean).join(" · ");
    out.push({ at: `${m.measured_on}T${m.created_at.slice(11)}`, kind: "treatment", icon: "document", title: "Meting toegevoegd", body, who: "Medewerker" });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;
};
