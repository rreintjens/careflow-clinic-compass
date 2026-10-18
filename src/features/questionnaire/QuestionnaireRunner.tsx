import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";

import { Logo } from "@/components/Logo";
import { PatientFrame } from "@/components/PatientFrame";
import {
  flowSteps, makeCtx, itemAnswered, pageProgress, redOnPage, toggleOption, visibleItems, visiblePages,
  type Answers, type FlowFile, type Item, type Page, type QuestionnaireDef, type RedOutcome,
} from "@/domain/questionnaire/engine";
import { yearsBetween } from "@/domain/questionnaire/expr";
import { cn } from "@/lib/utils";

export type UiTexts = Record<string, string>;

const fill = (s: string | undefined, vars: Record<string, string>) => (s ?? "").replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Patient-facing questionnaire at 390px; used in test mode now and in the booking flow later. */
export function QuestionnaireRunner({
  flow, def, ui, today, vars = {}, initial = {}, startPageId, onFinish, onRed, onAnswers, fullScreen = false,
}: {
  flow: Pick<FlowFile, "settings" | "computed_fields">;
  def: QuestionnaireDef;
  ui: UiTexts;
  today: string;
  vars?: Record<string, string>;
  initial?: Answers;
  startPageId?: string;
  onFinish?: (answers: Answers) => void;
  onRed?: (red: RedOutcome) => void;
  onAnswers?: (answers: Answers) => void;
  fullScreen?: boolean;
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [pageId, setPageId] = useState(startPageId ?? def.pages[0]?.id ?? "");
  const [red, setRed] = useState<RedOutcome | null>(null);
  const [showMissing, setShowMissing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Every new page (and the rejection screen) starts at the top.
  useEffect(() => { scrollRef.current?.scrollTo({ top: 0 }); if (fullScreen) window.scrollTo({ top: 0 }); }, [pageId, red, fullScreen]);
  useEffect(() => { onAnswers?.(answers); }, [answers, onAnswers]);
  const ctx = useMemo(() => makeCtx(flow, answers, today), [flow, answers, today]);
  const pages = visiblePages(def, ctx);
  const idx = Math.max(0, pages.findIndex((p) => p.id === pageId));
  const page = pages[idx];
  const set = (k: string, v: unknown) => setAnswers((a) => ({ ...a, [k]: v }));
  const t = (k: string, extra: Record<string, string | number> = {}) => fill(ui[k] ?? k, Object.fromEntries(Object.entries(extra).map(([a, b]) => [a, String(b)])));

  const restart = () => { setAnswers({}); setRed(null); setPageId(def.pages[0]?.id ?? ""); };
  const next = () => {
    if (!page) return;
    const missing = visibleItems(page, ctx).filter((i) => !i.optional && !itemAnswered(i, ctx.answers));
    if (missing.length) {
      setShowMissing(true);
      document.getElementById(`q-${missing[0]?.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowMissing(false);
    const r = redOnPage(def, page, ctx);
    if (r) { setRed(r); onRed?.(r); return; }
    const nextPage = pages[idx + 1];
    if (nextPage) setPageId(nextPage.id);
    else onFinish?.(answers);
  };
  const back = () => { setShowMissing(false); if (red) { setRed(null); return; } const prev = pages[idx - 1]; if (prev) setPageId(prev.id); };
  const progress = pages.length ? (idx + 1) / pages.length : 0;

  if (red) {
    const v = def.rejection?.variants?.[red.variant];
    const buttons = def.rejection?.buttons ?? [];
    return (
      <Frame scrollRef={scrollRef} fullScreen={fullScreen} progress={progress} onBack={back}
        footer={<>
          {buttons[0] && <button type="button" onClick={restart} className="h-[54px] w-full rounded-full bg-primary text-[17px] font-medium text-primary-foreground">{buttons[0]}</button>}
          {buttons[1] && <a href="https://www.bodyclinic.nl" target="_blank" rel="noreferrer" className="mt-4 block text-center text-[15px] text-primary">{buttons[1]}</a>}
        </>}>
        <h1 className="text-[28px] font-semibold leading-tight">{v?.title}</h1>
        <p className="mt-3 text-[15px] leading-[1.6]">{v?.body}</p>
        {v?.advice && <p className="mt-3 text-[15px] leading-[1.6]">{v.advice}</p>}
        <div className="mt-6 text-[13px]">{t("email_ask")} <span className="text-muted-foreground">{t("optional")}</span></div>
        <div className="mt-2 flex gap-2">
          <input type="email" placeholder={t("email_placeholder")} className="h-[50px] min-w-0 flex-1 rounded-[14px] bg-sand px-4 text-[15px] outline-none" />
          <button type="button" disabled className="h-[50px] rounded-full border border-primary px-5 text-[15px] text-primary">{t("email_send")}</button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t("email_note")}</p>
      </Frame>
    );
  }
  if (!page) return null;

  const isQuestions = !!page.items?.length;
  const prog = pageProgress(page, ctx);
  const many = (page.items?.length ?? 0) > 1;
  return (
    <Frame scrollRef={scrollRef} fullScreen={fullScreen} progress={progress} onBack={idx > 0 ? back : undefined}
      footer={<>
        {isQuestions && <p className="mb-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockIcon />{t("privacy")}</p>}
        <button type="button" onClick={next} className="h-[54px] w-full rounded-full bg-primary text-[17px] font-medium text-primary-foreground disabled:opacity-50">{fill(page.button, vars) || t("next")}</button>
      </>}>
      {(page.section || (!isQuestions && page.bullets)) && <div className="mb-2 text-[13px] text-primary">{page.section ?? t("section_intro")}</div>}
      {page.icon && (
        <div className="mx-auto mb-5 flex size-[72px] items-center justify-center rounded-full bg-teal-light">
          <span
            aria-hidden="true"
            className="size-[34px] bg-primary"
            style={{
              WebkitMaskImage: `url(/ui-icons/${page.icon}.svg)`, maskImage: `url(/ui-icons/${page.icon}.svg)`,
              WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
              WebkitMaskPosition: "center", maskPosition: "center",
            }}
          />
        </div>
      )}
      {(page.title || !many) && <h1 className="text-[28px] font-semibold leading-tight">{fill(page.title ?? page.items?.[0]?.text, vars)}</h1>}
      {page.body && <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{fill(page.body, vars)}</p>}
      {!page.title && !many && page.items?.[0]?.help && <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{page.items[0].help}</p>}
      {many && <p className="mt-2 text-xs text-muted-foreground">{t("answered", { k: prog.answered, m: prog.total })}</p>}
      {page.bullets && (
        <div className="mt-6 rounded-[18px] bg-sand p-5">
          <div className="mb-3 text-[15px] font-semibold">{t("good_to_know")}</div>
          <ul className="flex flex-col gap-2">{page.bullets.map((b) => <li key={b} className="flex gap-3 text-[15px]"><CheckIcon />{b}</li>)}</ul>
        </div>
      )}
      {page.type === "flow_overview" && (
        <ol className="mt-6 flex flex-col gap-4">
          {flowSteps(def, ctx, page.id, [t("step_appointment")], [t("step_details"), t("step_confirm")]).map((s, i) => (
            <li key={s.label} className="flex items-center gap-3 text-[15px]">
              <span className={cn("inline-flex size-[30px] items-center justify-center rounded-full text-[13px]", s.state === "done" ? "bg-primary text-primary-foreground" : s.state === "current" ? "border border-primary text-primary" : "bg-sand text-muted-foreground")}>{s.state === "done" ? "✓" : i + 1}</span>
              <span className={cn(s.state === "current" && "font-semibold", s.state === "todo" && "text-muted-foreground")}>{s.label}</span>
            </li>
          ))}
        </ol>
      )}
      {isQuestions && (
        <div className="mt-6 flex flex-col gap-6">
          {visibleItems(page, ctx).map((i) => (
            <div key={i.id} id={`q-${i.id}`} className={cn(showMissing && !i.optional && !itemAnswered(i, answers) && "-mx-3 rounded-[16px] bg-warning-bg px-3 py-3")}>
              <ItemInput item={i} page={page} answers={answers} set={set} t={t} today={today} showLabel={many} all={def} />
              {showMissing && !i.optional && !itemAnswered(i, answers) && <p role="alert" className="mt-2 text-[13px] text-warning">{t("missing_answer")}</p>}
            </div>
          ))}
        </div>
      )}
    </Frame>
  );
}

function Frame({ progress, onBack, children, footer, scrollRef, fullScreen }: { progress: number; onBack?: (() => void) | undefined; children: ReactNode; footer: ReactNode; scrollRef: RefObject<HTMLDivElement | null>; fullScreen: boolean }) {
  const card = (
    <div className={cn("flex flex-col bg-background", fullScreen ? "w-full flex-1" : "h-[844px] w-[390px] overflow-hidden rounded-[28px] border border-line")}>
      <div className="flex h-14 items-center justify-between px-5">
        <button type="button" aria-label="Terug" onClick={onBack} disabled={!onBack} className="disabled:opacity-0"><Chevron /></button>
        <span className="sm:hidden"><Logo small /></span><span className="hidden sm:inline-flex"><Logo mark /></span>
        <span aria-hidden="true"><CloseIcon /></span>
      </div>
      <div className="h-[3px] bg-mist"><div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} /></div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 pt-8 pb-6">{children}</div>
      <div className="px-5 pb-6">{footer}</div>
    </div>
  );
  return fullScreen ? <PatientFrame>{card}</PatientFrame> : card;
}

const pill = (on: boolean) => cn("flex min-h-[50px] w-full items-center gap-3 rounded-[14px] px-4 py-3 text-left text-[15px]", on ? "border border-primary bg-teal-light" : "border border-transparent bg-sand");
const fieldCls = "h-[54px] w-full rounded-[14px] bg-sand px-4 text-[17px] outline-none focus-visible:ring-1 focus-visible:ring-primary";

function ItemInput({ item, answers, set, t, today, showLabel, all }: { item: Item; page: Page; answers: Answers; set: (k: string, v: unknown) => void; t: (k: string, e?: Record<string, string | number>) => string; today: string; showLabel: boolean; all: QuestionnaireDef }) {
  const v = answers[item.id];
  const label = showLabel ? <div className="mb-3 text-[15px]">{item.text}</div> : null;
  const help = showLabel && item.help ? <p className="-mt-2 mb-3 text-[13px] text-muted-foreground">{item.help}</p> : null;
  switch (item.type) {
    case "single_choice":
    case "yes_no": {
      const options = item.type === "yes_no" ? [{ value: "yes", label: t("yes") }, { value: "no", label: t("no") }] : (item.options ?? []).map((o) => ({ value: o, label: o }));
      return (
        <div>{label}{help}
          <div className={cn("flex gap-2", item.type === "yes_no" ? "flex-row" : "flex-col")}>
            {options.map((o) => (
              <button key={o.value} type="button" onClick={() => set(item.id, o.value)} className={cn(pill(v === o.value), item.type === "yes_no" && "justify-center")}>
                {item.type !== "yes_no" && <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full border", v === o.value ? "border-primary" : "border-muted-foreground/50")}>{v === o.value && <span className="size-2.5 rounded-full bg-primary" />}</span>}
                {o.label}
              </button>
            ))}
          </div>
        </div>
      );
    }
    case "multi_choice": {
      const cur = Array.isArray(v) ? (v as string[]) : [];
      const box = (o: string) => (
        <button key={o} type="button" onClick={() => set(item.id, toggleOption(cur, o, item.exclusive_option))} className={pill(cur.includes(o))}>
          <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border", cur.includes(o) ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}>{cur.includes(o) && <CheckIcon small />}</span>{o}
        </button>
      );
      return (
        <div>{label}{help}
          <div className="flex flex-col gap-2">{(item.options ?? []).map(box)}</div>
          {item.exclusive_option && <><div className="my-3 h-px bg-line" />{box(item.exclusive_option)}</>}
        </div>
      );
    }
    case "date_segmented": return <div>{label}{help}<DobField value={typeof v === "string" ? v : ""} onChange={(x) => set(item.id, x)} t={t} today={today} /></div>;
    case "height_weight": {
      const h = answers["height_cm"], w = answers["weight_kg"];
      const digits = item.show_bmi_after_digits ?? 2;
      const showBmi = String(h ?? "").length >= digits && String(w ?? "").length >= digits && Number(h) > 0;
      const bmi = showBmi ? Number(w) / (Number(h) / 100) ** 2 : null;
      return (
        <div>{label}{help}
          <div className="grid grid-cols-2 gap-3">
            {(["height_cm", "weight_kg"] as const).map((k) => (
              <label key={k} className="flex flex-col gap-2 text-[13px]">{t(k === "height_cm" ? "height" : "weight")}
                <input inputMode="numeric" className={fieldCls} value={String(answers[k] ?? "")} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); set(k, d ? Number(d) : undefined); }} />
              </label>
            ))}
          </div>
          {bmi !== null && Number.isFinite(bmi) && <p className="mt-4 text-[15px] font-medium">{t("bmi_result", { bmi: bmi.toFixed(1).replace(".", ",") })}</p>}
        </div>
      );
    }
    case "measure_with_image":
    case "number": {
      const unknown = v === "unknown";
      return (
        <div>{label}{help}
          {item.type === "measure_with_image" && <div className="mb-5 flex h-[190px] items-center justify-center rounded-[18px] bg-mist" aria-label={item.image}><span className="h-[42px] w-[70px] rounded-[8px] bg-muted-foreground/20" /></div>}
          <div className="relative">
            <input inputMode="numeric" className={fieldCls} value={unknown ? "" : String(v ?? "")} onChange={(e) => { const d = e.target.value.replace(/[^\d]/g, ""); set(item.id, d ? Number(d) : undefined); }} />
            {item.unit && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">{item.unit}</span>}
          </div>
          {item.allow_unknown && <button type="button" onClick={() => set(item.id, unknown ? undefined : "unknown")} className={cn(pill(unknown), "mt-3")}>{item.allow_unknown}</button>}
        </div>
      );
    }
    case "text":
      return <div>{label}{help}<textarea rows={3} className="w-full rounded-[14px] bg-sand px-4 py-3 text-[15px] outline-none" value={String(v ?? "")} onChange={(e) => set(item.id, e.target.value)} /></div>;
    case "checkbox_required":
      return (
        <button type="button" onClick={() => set(item.id, v !== true)} className={pill(v === true)}>
          <span className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] border", v === true ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50")}>{v === true && <CheckIcon small />}</span>{item.text}
        </button>
      );
    case "answer_summary": {
      const rows = all.pages.flatMap((p) => p.items ?? []).filter((i) => i.type !== "answer_summary" && i.type !== "checkbox_required" && answers[i.id] !== undefined);
      return (
        <div>{label}
          <dl className="flex flex-col divide-y divide-line rounded-[14px] bg-sand px-4">
            {rows.map((i) => <div key={i.id} className="py-3"><dt className="text-xs text-muted-foreground">{i.text}</dt><dd className="text-[15px]">{fmt(answers[i.id], t)}</dd></div>)}
          </dl>
        </div>
      );
    }
  }
}

const fmt = (v: unknown, t: (k: string) => string) => (Array.isArray(v) ? v.join(", ") : v === "yes" ? t("yes") : v === "no" ? t("no") : String(v));

/** dd-mm-jjjj in three digit-only boxes with auto-advance; valid date only after the year; age shown. */
export function DobField({ value, onChange, t, today }: { value: string; onChange: (iso: string) => void; t: (k: string, e?: Record<string, string | number>) => string; today: string }) {
  const [y0, m0, d0] = value ? value.split("-") : ["", "", ""];
  const [parts, setParts] = useState({ d: d0 ?? "", m: m0 ?? "", y: y0 ?? "" });
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const update = (k: "d" | "m" | "y", raw: string, max: number, nextIdx?: number) => {
    const s = raw.replace(/\D/g, "").slice(0, max);
    const p = { ...parts, [k]: s };
    setParts(p);
    if (s.length === max && nextIdx !== undefined) refs[nextIdx]?.current?.focus();
    const iso = `${p.y}-${p.m.padStart(2, "0")}-${p.d.padStart(2, "0")}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    const valid = p.y.length === 4 && p.m && p.d && !Number.isNaN(dt.getTime()) && dt.getUTCDate() === Number(p.d) && dt.getUTCMonth() + 1 === Number(p.m);
    onChange(valid ? iso : "");
  };
  const age = value ? yearsBetween(value, today) : null;
  const box = "h-[54px] rounded-[14px] bg-sand text-center text-[17px] outline-none focus-visible:ring-1 focus-visible:ring-primary";
  return (
    <div>
      <div className="flex items-center gap-2">
        <input ref={refs[0]} inputMode="numeric" placeholder={t("dd")} className={cn(box, "w-[72px]")} value={parts.d} onChange={(e) => update("d", e.target.value, 2, 1)} />
        <span className="text-muted-foreground">-</span>
        <input ref={refs[1]} inputMode="numeric" placeholder={t("mm")} className={cn(box, "w-[72px]")} value={parts.m} onChange={(e) => update("m", e.target.value, 2, 2)} />
        <span className="text-muted-foreground">-</span>
        <input ref={refs[2]} inputMode="numeric" placeholder={t("yyyy")} className={cn(box, "w-[110px]")} value={parts.y} onChange={(e) => update("y", e.target.value, 4)} />
      </div>
      {age !== null && Number.isFinite(age) && <p className="mt-3 text-[13px] text-muted-foreground">{t("age_shown", { age })}</p>}
    </div>
  );
}

function Chevron() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>; }
function CloseIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>; }
function LockIcon() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>; }
function CheckIcon({ small }: { small?: boolean }) { return <svg width={small ? 12 : 16} height={small ? 12 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={cn("shrink-0", !small && "mt-1 text-primary")}><path d="M5 12l5 5 9-10" /></svg>; }
