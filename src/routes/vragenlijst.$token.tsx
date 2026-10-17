import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { getPatientQuestionnaire, savePatientQuestionnaire } from "@/data/patient-questionnaire.functions";
import type { Answers, FlowFile, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { QuestionnaireRunner } from "@/features/questionnaire/QuestionnaireRunner";

const pq = (token: string, merk: string | undefined) => queryOptions({ queryKey: ["patient-questionnaire", token, merk ?? ""], queryFn: () => getPatientQuestionnaire({ data: { token, merk } }) });

export const Route = createFileRoute("/vragenlijst/$token")({
  validateSearch: z.object({ merk: z.string().optional(), lang: z.enum(["nl", "en"]).optional() }),
  loaderDeps: ({ search }) => ({ merk: search.merk }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(pq(params.token, deps.merk)),
  head: () => ({
    meta: [
      { title: "Medische vragenlijst · The Body Clinic" },
      { name: "description", content: "Vul je medische vragenlijst in voor je consult bij The Body Clinic." },
      { property: "og:title", content: "Medische vragenlijst · The Body Clinic" },
      { property: "og:description", content: "Vul je medische vragenlijst in voor je consult." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientQuestionnaire,
});

function PatientQuestionnaire() {
  const { token } = Route.useParams();
  const s = Route.useSearch();
  const { data } = useSuspenseQuery(pq(token, s.merk));
  const save = useServerFn(savePatientQuestionnaire);
  const lang = s.lang ?? "nl";
  const tx = (key: string, vars: Record<string, string> = {}) => {
    const r = data.ui.find((u) => u.value === key);
    return ((lang === "en" && r?.label_en) || r?.label_nl || "").replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");
  };
  const [editing, setEditing] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const autosave = useCallback((a: Answers) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void save({ data: { token, merk: s.merk, answers: a, complete: false } }); }, 600);
  }, [save, token, s.merk]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!data.found) return <Plain><p className="text-[15px] leading-[1.6]">{tx("mq_not_found")}</p></Plain>;
  const ui = Object.fromEntries(data.ui.filter((u) => u.list_key === "questionnaire_ui").map((u) => [u.value, (lang === "en" && u.label_en) || u.label_nl]));

  if (data.status === "completed" && !editing) {
    const at = data.completedAt ? new Date(data.completedAt) : null;
    const dag = at ? at.toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { day: "numeric", month: "long", timeZone: "Europe/Amsterdam" }) : "";
    const tijd = at ? at.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" }) : "";
    return (
      <Plain footer={data.canEdit ? <PillButton size="lg" className="w-full" onClick={() => setEditing(true)}>{tx("mq_edit")}</PillButton> : null}>
        <p className="mb-2 text-[13px] text-primary">{tx("mq_label")}</p>
        <h1 className="text-[28px] font-semibold leading-tight">{tx("mq_done_title")}</h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{tx("mq_done_body", { dag, tijd, behandelaar: data.vars.behandelaar_voornaam })}</p>
        <div className="mt-6 rounded-[18px] bg-sand p-5">
          <p className="text-[15px] font-semibold">{tx("mq_changed")}</p>
          <p className="mt-2 text-[14px] leading-[1.6]">{tx("mq_changed_body")}</p>
        </div>
      </Plain>
    );
  }
  return (
    <QuestionnaireRunner fullScreen flow={data.flow as unknown as FlowFile} def={data.definition as unknown as QuestionnaireDef} ui={ui}
      today={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" })} initial={data.answers as Answers} vars={data.vars}
      onAnswers={autosave}
      onFinish={(a) => { window.clearTimeout(timer.current); void save({ data: { token, merk: s.merk, answers: a, complete: true } }); }} />
  );
}

function Plain({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className="flex min-h-screen w-full max-w-[390px] flex-col">
        <header className="flex h-14 items-center justify-center"><Logo small /></header>
        <div className="h-[3px] bg-primary" />
        <main className="flex-1 px-5 pb-6 pt-8">{children}</main>
        {footer && <footer className="px-5 pb-6">{footer}</footer>}
      </div>
    </div>
  );
}
