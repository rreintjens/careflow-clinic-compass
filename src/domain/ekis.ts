/**
 * eKis export: one file per day with the patients that arrived since the previous export and the
 * answers they filled in. Pure builder so the shape is testable; delivery stays a stub until the
 * real eKis connection exists (open punt bij Hamid, per het ontwerp).
 */
import { instantForLocal, zonedParts } from "./time";

export const EKIS_EXPORT_HOUR = 6;

export interface EkisPatient {
  patient_number: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  house_suffix: string | null;
  postcode: string | null;
  city: string | null;
  country: string | null;
  created_at: string;
}

export interface EkisAnswerSet {
  patient_id: string;
  questionnaire_key: string;
  status: string;
  completed_at: string | null;
  answers: Record<string, unknown>;
}

export interface EkisDocument {
  exported_at: string;
  format: "tbc-ekis-1";
  patients: Array<{
    patient_number: string;
    patient: Record<string, string | null>;
    questionnaires: Array<{ questionnaire_key: string; completed_at: string | null; answers: Record<string, unknown> }>;
  }>;
  counts: { patients: number; answer_sets: number };
}

/** Half-open window [from, to) covering everything new up to the export instant. */
export function exportWindow(lastRanAt: string | null, exportedAt: string): { from: string; to: string } {
  return { from: lastRanAt ?? "0001-01-01T00:00:00Z", to: exportedAt };
}

/** Patients in the window, oldest first; answers of those patients only, keyed by patient number. */
export function buildEkisDocument(
  patients: readonly EkisPatient[],
  answerSets: readonly EkisAnswerSet[],
  exportedAt: string,
  lastRanAt: string | null,
): EkisDocument {
  const { from, to } = exportWindow(lastRanAt, exportedAt);
  const fresh = patients
    .filter((p) => p.created_at > from && p.created_at < to)
    .sort((a, b) => a.patient_number.localeCompare(b.patient_number, "nl"));
  const numbers = new Map(fresh.map((p) => [p.id as string, p.patient_number]));
  const byPatient = new Map<string, EkisAnswerSet[]>();
  for (const set of answerSets) {
    if (!numbers.has(set.patient_id)) continue;
    (byPatient.get(numbers.get(set.patient_id)!) ?? byPatient.set(numbers.get(set.patient_id)!, []).get(numbers.get(set.patient_id)!)!).push(set);
  }
  const rows = fresh.map((p) => {
    const sets = (byPatient.get(p.patient_number) ?? []).sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
    const { id: _id, ...rest } = p as EkisPatient & { id?: string };
    return {
      patient_number: p.patient_number,
      patient: Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v === undefined ? null : String(v)])),
      questionnaires: sets.map((s) => ({ questionnaire_key: s.questionnaire_key, completed_at: s.completed_at, answers: s.answers })),
    };
  });
  return {
    exported_at: exportedAt,
    format: "tbc-ekis-1",
    patients: rows,
    counts: { patients: rows.length, answer_sets: rows.reduce((n, r) => n + r.questionnaires.length, 0) },
  };
}

/** The next 06:00 in the brand's own time zone, strictly after `now`. */
export function nextExportAt(now: Date, tz: string, hour = EKIS_EXPORT_HOUR): Date {
  const today = zonedParts(now, tz);
  const at = (date: string) => instantForLocal(date, hour * 60, tz);
  const next = at(today.date);
  return next.getTime() > now.getTime() ? next : at(addLocalDay(today.date, 1));
}

const addLocalDay = (date: string, n: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "Vandaag 06:00" / "Morgen 06:00" as the koppelingen screen shows it. */
export function exportLabel(at: Date, now: Date, tz: string): string {
  const day = zonedParts(at, tz).date;
  const today = zonedParts(now, tz).date;
  const tomorrow = addLocalDay(today, 1);
  const time = new Intl.DateTimeFormat("nl-NL", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return `${day === today ? "vandaag" : day === tomorrow ? "morgen" : new Intl.DateTimeFormat("nl-NL", { timeZone: tz, day: "numeric", month: "long" }).format(at)} ${time}`;
}
