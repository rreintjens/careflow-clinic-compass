import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { getPatientQuestionnaire, savePatientQuestionnaire } from "@/data/patient-questionnaire.functions";
import { resumeState, type Answers, type FlowFile, type QuestionnaireDef } from "@/domain/questionnaire/engine";
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
  const [startPage, setStartPage] = useState<string | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);
  const autosave = useCallback((a: Answers) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void save({ data: { token, merk: s.merk, answers: a, complete: false } }); }, 600);
  }, [save, token, s.merk]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (!data.found) return <Plain><p className="text-[15px] leading-[1.6]">{tx("mq_not_found")}</p></Plain>;
  const ui = Object.fromEntries(data.ui.filter((u) => u.list_key === "questionnaire_ui").map((u) => [u.value, (lang === "en" && u.label_en) || u.label_nl]));
  const fillVars = (text: string) => text.replace(/\{(\w+)\}/g, (_, k: string) => (data.vars as Record<string, string>)[k] ?? "");

  if (data.status === "in_progress" && !editing) {
    const resume = resumeState(data.definition as unknown as QuestionnaireDef, data.flow as unknown as FlowFile, data.answers as Answers, new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" }));
    const answered = resume.pages.reduce((n, p) => n + p.answered, 0);
    const total = resume.pages.reduce((n, p) => n + p.total, 0);
    const nextTitle = fillVars(resume.pages.find((p) => p.id === resume.nextPageId)?.title ?? "");
    return (
      <Plain progress={total ? answered / total : 0} footer={<PillButton size="lg" className="w-full" onClick={() => { setStartPage(resume.nextPageId ?? undefined); setEditing(true); }}>{tx("mq_resume_button", { pagina_titel: nextTitle })}</PillButton>}>
        <p className="mb-2 text-[13px] font-medium text-primary">{tx("mq_label")}</p>
        <h1 className="text-[26px] font-semibold leading-[1.2] tracking-[-0.02em]">{tx("mq_resume_title")}</h1>
        <p className="mt-2 text-[14px] leading-[1.5] text-muted-foreground">{tx("mq_resume_body", { pagina: String(resume.pageNumber), paginas: String(resume.pageCount) })}</p>
        <div className="mt-5 flex flex-col gap-2">
          {resume.pages.map((p) => {
            const current = p.id === resume.nextPageId && !p.complete;
            return (
              <div key={p.id} className={`flex items-center gap-3 rounded-[12px] px-3.5 py-3 ${current ? "bg-teal-light" : "bg-sand"}`}>
                {p.complete
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-primary" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  : <span className={`size-[18px] shrink-0 rounded-full border-[1.5px] ${current ? "border-primary" : "border-mist"}`} />}
                <span className={`flex-1 text-[14px] ${current ? "font-semibold" : ""}`}>{fillVars(p.title)}</span>
                {(p.complete || current) && <span className="text-[12px] text-muted-foreground">{tx("mq_resume_of", { k: String(p.answered), m: String(p.total) })}</span>}
              </div>
            );
          })}
        </div>
        <p className="mt-5 text-[13px] leading-[1.5] text-muted-foreground">{tx("mq_resume_consult")}</p>
      </Plain>
    );
  }

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
      today={new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" })} initial={data.answers as Answers} vars={data.vars} startPageId={startPage}
      onAnswers={autosave}
      onFinish={(a) => { window.clearTimeout(timer.current); void save({ data: { token, merk: s.merk, answers: a, complete: true } }); }} />
  );
}

function Plain({ children, footer, progress = 1 }: { children: React.ReactNode; footer?: React.ReactNode; progress?: number }) {
  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className="flex min-h-screen w-full max-w-[390px] flex-col">
        <header className="flex h-14 items-center justify-center"><Logo small /></header>
        <div className="h-[3px] bg-[#EEF1F2]"><div className="h-[3px] bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <main className="flex-1 px-5 pb-6 pt-8">{children}</main>
        {footer && <footer className="px-5 pb-6">{footer}</footer>}
      </div>
    </div>
  );
}
