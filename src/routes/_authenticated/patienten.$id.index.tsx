import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { standaloneConsultsQuery } from "@/data/consults";
import { createFileRoute, Link } from "@tanstack/react-router";

import { dossierQuery } from "@/data/patients";
import { signalsOf } from "@/features/agenda/PatientCard";
import { buildTimeline } from "@/features/dossier/timeline";
import { TimelineList } from "@/features/dossier/TimelineList";

export const Route = createFileRoute("/_authenticated/patienten/$id/")({ head: () => ({ meta: [{ title: "Overzicht · Dossier · The Body Clinic" }, { name: "description", content: "Patiëntoverzicht en laatste gebeurtenissen in het dossier." }, { property: "og:title", content: "Dossieroverzicht · The Body Clinic" }, { property: "og:description", content: "Patiëntoverzicht en laatste gebeurtenissen in het dossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Overview });

function Overview() {
  const { id } = Route.useParams();
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const { data: consults = [] } = useQuery(standaloneConsultsQuery(id));
  if (!d.patient) return null;
  const triage = d.sets.find((s) => s.questionnaire_key === "triage");
  const medical = d.sets.find((s) => s.questionnaire_key !== "triage");
  const a = (triage?.answers ?? {}) as Record<string, unknown>;
  const h = Number(a["height_cm"]), w = Number(a["weight_kg"]);
  const bmi = h && w ? (w / (h / 100) ** 2).toFixed(1).replace(".", ",") : null;
  const when = (s?: string | null) => (s ? new Date(s).toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }) : "");
  const signals = signalsOf(d.sets);
  const rows: Array<[string, string]> = [
    ["BMI en gewicht", bmi ? `${bmi} · ${h} cm, ${w} kg, gemeten bij het boeken op ${when(triage?.created_at)}` : "Niet bekend"],
    ["Triage", triage ? (triage.status === "completed" ? `Groen${signals.length ? `; signalen: ${signals.map((s) => s.label.toLowerCase()).join(", ")}` : ""}` : "Gestart, niet afgerond") : "Niet doorlopen"],
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
      <dl className="mt-5">{rows.map(([k, v]) => <div key={k} className="grid grid-cols-[220px_1fr] gap-4 border-b border-mist py-3 text-[14px]"><dt className="whitespace-nowrap text-muted-foreground">{k}</dt><dd>{v}</dd></div>)}</dl>
      <p className="mb-4 mt-6 text-[14px] font-semibold">Laatste gebeurtenissen</p>
      <TimelineList events={buildTimeline(d, consults).slice(0, 3)} />
      <Link to="/patienten/$id/tijdlijn" params={{ id }} className="text-[14px] text-primary underline">Volledige tijdlijn</Link>
    </section>
  );
}
