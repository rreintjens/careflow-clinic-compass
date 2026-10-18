import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { PillButton } from "@/components/PillButton";
import type { AgendaAppt } from "@/data/agenda";
import { fmtTime } from "@/domain/slots";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export type CardAppt = AgendaAppt & { s: { date: string; minute: number }; e: { minute: number } };
type Signal = { item: string; label: string };

const ageOf = (dob: string, on: string) => { const [y, m, d] = dob.split("-").map(Number) as [number, number, number]; const [Y, M, D] = on.split("-").map(Number) as [number, number, number]; return Y - y - (M < m || (M === m && D < d) ? 1 : 0); };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Questionnaire status + signals for one appointment (RLS decides whether medical data is visible). */
export const appointmentAnswersQuery = (appointmentId: string) => ({
  queryKey: ["appt-answers", appointmentId],
  queryFn: async () => {
    const { data } = await supabase.from("answer_sets").select("questionnaire_key, status, completed_at, signals").eq("appointment_id", appointmentId);
    return data ?? [];
  },
});
export const signalsOf = (sets: ReadonlyArray<{ signals: unknown }>): Signal[] => sets.flatMap((s) => (Array.isArray(s.signals) ? (s.signals as Signal[]) : []));

/** The one patient card: identical in the agenda, Mijn dag and the patient list. */
export function PatientCard({ a, treatment, online, onClose, framed = false }: { a: CardAppt; treatment: string; online: boolean; onClose?: () => void; framed?: boolean }) {
  const p = a.patient;
  const { data: sets = [] } = useQuery(appointmentAnswersQuery(a.id));
  const signals = signalsOf(sets);
  const medical = sets.find((x) => x.status === "completed" && x.completed_at && x.questionnaire_key !== sets[0]?.questionnaire_key) ?? sets.find((x) => x.status === "completed");
  const day = cap(new Date(`${a.s.date}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }));
  const filled = medical?.completed_at ? `Ingevuld, ${new Date(medical.completed_at).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}` : sets.length ? "Nog niet afgerond" : "Nog niet ingevuld";
  const facts: Array<[string, string]> = [["Medische vragenlijst", filled], ["Telefoon", p?.phone ?? ""], ["Geboekt via", a.referral_source ?? a.source ?? ""]];
  return (
    <div className={cn("flex flex-col gap-5 bg-background p-6", framed ? "rounded-[20px] ring-1 ring-primary" : "")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] text-muted-foreground">{day} · {fmtTime(a.s.minute)} tot {fmtTime(a.e.minute)}{online ? " · online" : ""}</p>
          <h2 className="mt-1 text-[22px] font-semibold">{p ? `${p.first_name} ${p.last_name}` : ""}</h2>
          <p className="text-[13px] text-muted-foreground">{[p?.patient_number, p?.date_of_birth ? `${ageOf(p.date_of_birth, a.s.date)} jaar` : null, `${a.new_patient ? "eerste " : ""}${treatment.toLowerCase()}`].filter(Boolean).join(" · ")}</p>
        </div>
        {onClose ? <button type="button" aria-label="Sluiten" onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/kruis.svg" alt="" className="size-4" /></button>
          : a.new_patient ? <span className="rounded-full bg-teal-light px-3 py-1 text-[12px] text-primary">Nieuw</span> : null}
      </div>
      <Link to="/patienten/$id" params={{ id: p?.id ?? "" }} disabled={!p}><PillButton size="lg" className="w-full">Open dossier</PillButton></Link>
      {online && (
        <div className="flex items-center gap-4 rounded-[14px] bg-sand p-4">
          {a.meet_link
            ? <a href={a.meet_link} target="_blank" rel="noreferrer"><PillButton variant="outline"><img src="/ui-icons/videogesprek.svg" alt="" className="size-4" />Start Google Meet</PillButton></a>
            : <PillButton variant="outline" disabled><img src="/ui-icons/videogesprek.svg" alt="" className="size-4" />Start Google Meet</PillButton>}
          <p className="text-[12px] text-muted-foreground">Dezelfde link als in je Google Agenda en in de mail van de patiënt.</p>
        </div>
      )}
      {signals.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide">Signalen</p>
          <div className="flex flex-wrap gap-2">{signals.map((x) => <span key={x.item} className="whitespace-nowrap rounded-full bg-signal px-3 py-1 text-[12px] ring-1 ring-signal-border">{x.label}</span>)}</div>
        </div>
      )}
      <dl className="flex flex-col">
        {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-mist py-2.5 text-[13px]"><dt className="whitespace-nowrap text-muted-foreground">{k}</dt><dd className="text-right">{v}</dd></div>)}
      </dl>
      <p className="text-[12px] text-muted-foreground">Deze kaart is overal hetzelfde: in de agenda, in Mijn dag en in de patiëntenlijst. Het volledige dossier open je met de knop bovenaan.</p>
    </div>
  );
}
