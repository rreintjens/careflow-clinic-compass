import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { standaloneConsultsQuery } from "@/data/consults";
import { measurementsQuery } from "@/data/measurements";
import { measurementWithBmi } from "@/domain/measurements";
import { createFileRoute, Link } from "@tanstack/react-router";

import { dossierQuery } from "@/data/patients";
import { signalsOf } from "@/features/agenda/PatientCard";
import { PatientSideCards } from "@/features/dossier/PatientSideCards";
import { buildTimeline } from "@/features/dossier/timeline";
import { TimelineList } from "@/features/dossier/TimelineList";
import { formatClinicalDate } from "@/domain/time";

export const Route = createFileRoute("/_authenticated/patienten/$id/")({ head: () => ({ meta: [{ title: "Overzicht · Dossier · The Body Clinic" }, { name: "description", content: "Patiëntoverzicht en laatste gebeurtenissen in het dossier." }, { property: "og:title", content: "Dossieroverzicht · The Body Clinic" }, { property: "og:description", content: "Patiëntoverzicht en laatste gebeurtenissen in het dossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Overview });

function Overview() {
  const { id: key } = Route.useParams();
  const id = useSuspenseQuery(dossierQuery(key)).data.patient?.id ?? "";
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const { data: consults = [] } = useQuery(standaloneConsultsQuery(id));
  const { data: measurements = [] } = useQuery(measurementsQuery(id));
  if (!d.patient) return null;
  const triage = d.sets.find((s) => s.questionnaire_key === "triage");
  const medical = d.sets.find((s) => s.questionnaire_key !== "triage");
  const a = (triage?.answers ?? {}) as Record<string, unknown>;
  const tri = { measured_on: triage?.completed_at ?? triage?.created_at ?? "", height_cm: Number(a["height_cm"]) || null, weight_kg: Number(a["weight_kg"]) || null };
  const history = [tri, ...measurements];
  const latest = [...history].filter((m) => m.weight_kg !== null).sort((a, b) => b.measured_on.localeCompare(a.measured_on))[0];
  const calculated = latest ? measurementWithBmi(latest, history) : null;
  const h = calculated?.height_cm, w = calculated?.weight_kg;
  const bmi = calculated?.bmi?.toFixed(1).replace(".", ",");
  const when = (s?: string | null) => (s ? formatClinicalDate(s, true) : "");
  const signals = signalsOf(d.sets);
  const rows: Array<[string, string]> = [
    ["BMI en gewicht", w ? `${bmi ?? "BMI niet bekend"} · ${h ? `${h} cm, ` : ""}${w} kg, ${latest === tri ? "gemeten bij het boeken op" : "gemeten op"} ${when(latest?.measured_on)}` : "Niet bekend"],
    ["Triage", triage ? (triage.status === "completed" ? `Groen${signals.length ? `, met ${signals.length === 1 ? "signaal" : "signalen"}: ${signals.map((s) => s.label).join(", ")}` : ""}` : "Gestart, niet afgerond") : "Niet doorlopen"],
    ["Medische vragenlijst", medical?.completed_at ? `Ingevuld op ${when(medical.completed_at)}` : medical ? "Gestart, nog niet afgerond" : "Nog niet ingevuld"],
    ["Huisarts", d.patient.gp_name ?? "Niet bekend"],
  ];
  return (
    <section className="rounded-[20px] p-6 ring-1 ring-mist">
      <h3 className="text-[17px] font-semibold">Overzicht</h3>
      <p className="text-[13px] text-muted-foreground">Alles van deze patiënt op één scherm; de tabbladen gaan de diepte in</p>
      {signals.length > 0 && (
        <div className="mt-5"><p className="mb-2 text-[13px] font-medium">Let op voor het consult</p>
          <div className="rounded-[14px] bg-sand p-4 text-[14px]">{signals.map((s) => s.label).join(". ")}.</div></div>
      )}
      <dl className="mt-5">{rows.map(([k, v]) => <div key={k} className="grid min-w-0 gap-1 border-b border-mist py-3 text-[14px] sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words">{v}</dd></div>)}</dl>
      <p className="mb-4 mt-6 text-[14px] font-semibold">Laatste gebeurtenissen</p>
      <TimelineList events={buildTimeline(d, consults, measurements).slice(0, 3)} />
      <Link to="/patienten/$id/tijdlijn" params={{ id: key }} className="text-[14px] text-primary underline">Volledige tijdlijn</Link>
      <PatientSideCards d={d} />
    </section>
  );
}
