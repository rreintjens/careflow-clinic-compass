import type { Dossier } from "@/data/patients";

export type TimelineKind = "appointments" | "questionnaires" | "contact" | "treatment" | "system";
export interface TimelineEvent { at: string; kind: TimelineKind; icon: string; title: string; body: string; who: string; meet?: string | null }

const STATUS: Record<string, string> = { booked: "", cancelled: " · geannuleerd", no_show: " · niet verschenen", completed: " · afgerond" };

/** Events derived from stored rows, newest first. */
export function buildTimeline(d: Dossier): TimelineEvent[] {
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
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Amsterdam" });
  return `${day.charAt(0).toUpperCase()}${day.slice(1)} · ${d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}`;
};
