import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { Card } from "@/components/Card";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { optLabel, orgQuery } from "@/data/organisation";
import { defOf, flowOf, questionnairesQuery, versionsOf, workingVersion } from "@/data/questionnaires";
import { collectSignals, makeCtx, prefillAnswers, type Answers, type FlowFile, type RedOutcome } from "@/domain/questionnaire/engine";
import { QuestionnaireRunner } from "@/features/questionnaire/QuestionnaireRunner";

export const Route = createFileRoute("/_authenticated/boekingsflow/vragenlijsten/$id_/test")({
  head: () => ({ meta: [{ title: "Testmodus vragenlijst · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { pagina?: string; versie?: string } => ({ ...(typeof s["pagina"] === "string" ? { pagina: s["pagina"] } : {}), ...(typeof s["versie"] === "string" ? { versie: s["versie"] } : {}) }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(questionnairesQuery), context.queryClient.ensureQueryData(orgQuery)]),
  component: TestMode,
});

/** Test data for text placeholders; test mode never stores answers. */
const TEST_VARS = { voornaam: "Sanne", behandelaar_voornaam: "Feikje", dag: "dinsdag 21 oktober", tijd: "10:30" };

function TestMode() {
  const { id } = Route.useParams();
  const { pagina, versie } = Route.useSearch();
  const { data } = useSuspenseQuery(questionnairesQuery);
  const { data: org } = useSuspenseQuery(orgQuery);
  const q = data.questionnaires.find((x) => x.id === id);
  const versions = q ? versionsOf(data, q.id) : [];
  const [versionId, setVersionId] = useState(q ? (versions.find((v) => v.id === versie)?.id ?? workingVersion(data, q.id)?.id ?? "") : "");
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ answers: Answers; red?: RedOutcome } | null>(null);
  const def = defOf(versions.find((v) => v.id === versionId));
  const flow = q ? flowOf(data, q.flow_id) : undefined;
  const doc = (flow?.document ?? {}) as unknown as FlowFile;
  const triageDef = defOf(data.questionnaires.filter((x) => x.flow_id === q?.flow_id && x.moment === "before_booking_confirmation").map((x) => workingVersion(data, x.id))[0]);
  const today = new Date().toISOString().slice(0, 10);
  const initial = useMemo(() => (def && def.prefill_from_triage ? prefillAnswers(def, { sex: "Vrouw", height_cm: 170, weight_kg: 95, conditions: ["Geen van deze"], weightloss_meds_now: "Nee", comorbidities: ["Geen van deze"] }) : {}), [def]);
  if (!q || !def) return <p className="text-sm">Deze vragenlijst bestaat niet.</p>;
  const signals = result ? collectSignals(def, makeCtx(doc, result.answers, today)) : [];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/boekingsflow/vragenlijsten/$id" params={{ id }} className="text-[13px] text-primary">{def.name}</Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Testmodus</h1>
          <span className="rounded-full bg-signal px-3 py-1 text-xs">{data.uiTexts["test_mode"]}</span>
        </div>
      </div>
      <div className="grid grid-cols-[390px_minmax(0,1fr)] items-start gap-8">
        <QuestionnaireRunner key={`${versionId}-${run}`} flow={doc} def={def} ui={data.uiTexts} today={today} vars={TEST_VARS} initial={initial} {...(pagina ? { startPageId: pagina } : {})}
          onFinish={(answers) => setResult({ answers })} onRed={(red) => setResult({ answers: {}, red })} />
        <div className="flex flex-col gap-4">
          <Card title="Versie">
            <Select label="Versie" value={versionId} onChange={(v) => { setVersionId(v); setRun((r) => r + 1); setResult(null); }} options={versions.map((v) => ({ value: v.id, label: `Versie ${v.version_no} · ${optLabel(org, "questionnaire_status", v.status)}` }))} />
            <div className="mt-4"><PillButton variant="outline" onClick={() => { setRun((r) => r + 1); setResult(null); }}>Opnieuw beginnen</PillButton></div>
          </Card>
          {result && (
            <Card title="Uitkomst">
              {result.red ? (
                <p className="text-sm">{data.uiTexts["outcome_red"]}: {optLabel(org, "questionnaire_rejection", result.red.variant) || result.red.variant} (reden: {result.red.reason}). Antwoorden worden niet bewaard.</p>
              ) : (
                <div className="flex flex-col gap-2 text-sm">
                  <p>{def.moment === "after_booking" ? "Klaar; in het echt gaan de antwoorden naar het dossier." : `${data.uiTexts["outcome_green"]}.`}</p>
                  {signals.length ? <ul className="list-disc pl-5">{signals.map((s) => <li key={s.item}>Signaal: {s.label}</li>)}</ul> : <p className="text-muted-foreground">Geen signalen.</p>}
                </div>
              )}
            </Card>
          )}
          {!triageDef && def.prefill_from_triage && <p className="text-xs text-muted-foreground">Voorinvulling uit de triage gebruikt testgegevens.</p>}
        </div>
      </div>
    </div>
  );
}
