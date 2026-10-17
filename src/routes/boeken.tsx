import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { dayPart, nextStep, sortLocations, type Catalog } from "@/domain/booking";
import { fmtTime, type Slot } from "@/domain/slots";
import { cn } from "@/lib/utils";
import { getBookingCatalog, getBookingSlots, getTriage, holdSlot, releaseHold } from "@/data/booking.functions";
import { QuestionnaireRunner } from "@/features/questionnaire/QuestionnaireRunner";
import type { Answers, FlowFile, QuestionnaireDef } from "@/domain/questionnaire/engine";

const search = z.object({
  merk: z.string().optional(), lang: z.enum(["nl", "en"]).optional(), bron: z.string().optional(),
  cat: z.string().optional(), sub: z.string().optional(), t: z.string().optional(), l: z.string().optional(),
  p: z.string().optional(), d: z.string().optional(), tijd: z.string().optional(), stap: z.string().optional(),
});
type Search = z.infer<typeof search>;

const catalogQuery = (merk: string | undefined) => queryOptions({ queryKey: ["booking-catalog", merk ?? ""], queryFn: () => getBookingCatalog({ data: { merk } }), staleTime: 60_000 });

export const Route = createFileRoute("/boeken")({
  validateSearch: search,
  loaderDeps: ({ search: s }) => ({ merk: s.merk }),
  loader: ({ context, deps }) => context.queryClient.ensureQueryData(catalogQuery(deps.merk)),
  head: () => ({
    meta: [
      { title: "Afspraak maken · The Body Clinic" },
      { name: "description", content: "Maak online een afspraak bij The Body Clinic: kies je behandeling, locatie en tijd." },
      { property: "og:title", content: "Afspraak maken · The Body Clinic" },
      { property: "og:description", content: "Kies je behandeling, locatie en tijd." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Booking,
});

type Cat = Awaited<ReturnType<typeof getBookingCatalog>>;
type Full = Extract<Cat, { categories: unknown }>;

function Booking() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/boeken" });
  const { data } = useSuspenseQuery(catalogQuery(s.merk));
  const lang = s.lang ?? "nl";
  const tx = (key: string, vars: Record<string, string | number> = {}) => {
    const r = data.ui.find((u) => (u.list_key === "booking_ui" || u.list_key === "questionnaire_ui") && u.value === key);
    const base = (lang === "en" && r?.label_en) || r?.label_nl || "";
    return base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  };
  const go = (patch: Partial<Search>, replace = false) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace });

  if (!("categories" in data) || !data.tenant) return <Shell lang={lang} onLang={() => go({ lang: lang === "nl" ? "en" : "nl" })}><p className="pt-10 text-[15px]">{tx("unknown_brand")}</p></Shell>;
  const c = data as Full;
  const name = (x: { name_nl: string; name_en: string | null }) => (lang === "en" && x.name_en) || x.name_nl;
  const locationsFor = (tid: string) => c.treatmentLocations.filter((x) => x.treatment_id === tid && c.locations.some((l) => l.id === x.location_id)).map((x) => x.location_id);
  const catalog: Catalog = { categories: c.categories, links: c.links, treatments: c.treatments, locationsFor };
  const step = nextStep(catalog, s);
  const progress = { category: 0.1, subcategory: 0.15, treatment: 0.2, location: 0.3, practitioner: 0.4, planner: 0.45, none: 0 }[step.kind];
  const back = step.kind === "category" ? undefined : () => window.history.back();
  const close = () => navigate({ search: { merk: s.merk, lang: s.lang, bron: s.bron } });
  const phone = c.tenant.phone;

  if (step.kind === "planner" && s.stap === "vasthouden" && s.d && s.tijd) {
    return <HoldStep c={c} s={s} treatmentId={step.treatment} locationId={step.location} practitionerId={step.practitioner ?? "any"} tx={tx} lang={lang} go={go} />;
  }

  return (
    <Shell lang={lang} progress={progress} onBack={back} onClose={close} onLang={step.kind === "category" ? () => go({ lang: lang === "nl" ? "en" : "nl" }, true) : undefined}
      footer={step.kind === "category" && phone ? <p className="text-center text-[13px] text-muted-foreground">{tx("call")} <a href={`tel:${phone}`} className="text-primary underline">{phone}</a></p> : null}>
      {step.kind === "none" && <p className="pt-10 text-[15px]">{tx("nothing_bookable")}</p>}
      {step.kind === "category" && (
        <List title={tx("q_category")} rows={step.options.map((id) => { const x = c.categories.find((k) => k.id === id); return { id, title: x ? name(x) : "", icon: x?.icon }; })} onPick={(id) => go({ cat: id })} />
      )}
      {step.kind === "subcategory" && (
        <List title={name(c.categories.find((k) => k.id === step.category) ?? { name_nl: "", name_en: null })} rows={step.options.map((id) => { const x = c.categories.find((k) => k.id === id); return { id, title: x ? name(x) : "", icon: x?.icon }; })} onPick={(id) => go({ sub: id })} />
      )}
      {step.kind === "treatment" && (
        <List title={tx("q_treatment")} rows={step.options.map((id) => { const x = c.treatments.find((k) => k.id === id); return { id, title: x ? name(x) : "", sub: x ? `${x.duration_min} min` : "", icon: x?.icon }; })} onPick={(id) => go({ t: id })} />
      )}
      {step.kind === "location" && <LocationStep c={c} treatmentId={step.treatment} options={step.options} tx={tx} name={name} onPick={(id) => go({ l: id })} />}
      {step.kind === "practitioner" && <PractitionerStep c={c} s={s} treatmentId={step.treatment} locationId={step.location} required={step.required} tx={tx} onPick={(p) => go({ p, stap: undefined, tijd: undefined })} />}
      {step.kind === "planner" && <PlannerStep c={c} s={s} step={step} tx={tx} lang={lang} go={go} />}
    </Shell>
  );
}

function Shell({ children, footer, progress = 0, onBack, onClose, onLang, lang }: { children: React.ReactNode; footer?: React.ReactNode; progress?: number; onBack?: (() => void) | undefined; onClose?: () => void; onLang?: (() => void) | undefined; lang: string }) {
  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className="flex min-h-screen w-full max-w-[390px] flex-col">
        <header className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-2">
          {onLang ? <button type="button" onClick={onLang} className="text-[13px] font-semibold text-primary">{lang === "nl" ? "EN" : "NL"}</button>
            : onBack ? <button type="button" onClick={onBack} aria-label="Terug" className="flex justify-center"><img src="/ui-icons/pijl-links.svg" alt="" className="size-5" /></button> : <span />}
          <span className="flex justify-center"><Logo small /></span>
          {onClose ? <button type="button" onClick={onClose} aria-label="Sluiten" className="flex justify-center"><img src="/ui-icons/kruis.svg" alt="" className="size-5" /></button> : <span />}
        </header>
        <div className="h-[3px] bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <main className="flex flex-1 flex-col px-5 pb-6 pt-8">{children}</main>
        {footer && <footer className="px-5 pb-6">{footer}</footer>}
      </div>
    </div>
  );
}

function Title({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return <div className="mb-6"><h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">{children}</h1>{sub && <div className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{sub}</div>}</div>;
}

const Chevron = () => <img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4 shrink-0" />;

function List({ title, rows, onPick }: { title: string; rows: Array<{ id: string; title: string; sub?: string; icon?: string | null | undefined }>; onPick: (id: string) => void }) {
  return (
    <>
      <Title>{title}</Title>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <button key={r.id} type="button" onClick={() => onPick(r.id)} className="flex min-h-[60px] items-center gap-4 rounded-[16px] bg-sand px-5 text-left">
            <span className="flex size-8 shrink-0 items-center justify-center">{r.icon && <img src={`/treatment-icons/${r.icon}.png`} alt="" className="size-7" />}</span>
            <span className="flex-1"><span className="block whitespace-nowrap text-[16px]">{r.title}</span>{r.sub && <span className="block text-[13px] text-muted-foreground">{r.sub}</span>}</span>
            <Chevron />
          </button>
        ))}
      </div>
    </>
  );
}

type Tx = (k: string, v?: Record<string, string | number>) => string;

function eligiblePractitioners(c: Full, treatmentId: string, locationId: string) {
  const at = new Set(c.practitionerLocations.filter((x) => x.location_id === locationId).map((x) => x.practitioner_id));
  return c.practitioners.filter((p) => at.has(p.id) && c.practitionerTreatments.some((x) => x.practitioner_id === p.id && x.treatment_id === treatmentId && !(x.excluded_location_ids ?? []).includes(locationId)));
}
const roleName = (c: Full, roleId: string | null, lang = "nl") => { const r = c.roles.find((x) => x.id === roleId); return r ? ((lang === "en" && r.name_en) || r.name_nl) : ""; };

function LocationStep({ c, treatmentId, options, tx, name, onPick }: { c: Full; treatmentId: string; options: string[]; tx: Tx; name: (x: { name_nl: string; name_en: string | null }) => string; onPick: (id: string) => void }) {
  const t = c.treatments.find((x) => x.id === treatmentId);
  const locs = sortLocations(c.locations.filter((l) => options.includes(l.id)));
  const roles = [...new Set(c.treatmentRoles.filter((x) => x.treatment_id === treatmentId).map((x) => roleName(c, x.role_id).toLowerCase()))];
  const people = c.practitioners.filter((p) => c.practitionerTreatments.some((x) => x.practitioner_id === p.id && x.treatment_id === treatmentId)).slice(0, 3);
  return (
    <>
      <Title sub={t && (
        <span className="flex items-center gap-3">
          <span className="flex -space-x-3">{people.map((p) => <Avatar key={p.id} src={p.photo} size={40} />)}</span>
          <span>{tx("duration_line", { rol: roles.length === 1 ? roles[0] ?? "" : tx("practitioner"), min: t.duration_min })}</span>
        </span>
      )}>{tx("q_location")}</Title>
      <div className="flex flex-col gap-2">
        {locs.map((l, i) => {
          const online = l.kind === "online";
          return (
            <button key={l.id} type="button" onClick={() => onPick(l.id)} className={cn("relative flex min-h-[64px] items-center gap-4 rounded-[16px] px-5 py-3 text-left", online && i === 0 ? "border border-primary bg-background" : "bg-sand")}>
              {online && i === 0 && <span className="absolute -top-2.5 right-4 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-medium text-primary-foreground">{tx("recommended")}</span>}
              <img src={online ? "/ui-icons/videogesprek.svg" : "/ui-icons/locatie.svg"} alt="" className="size-5 shrink-0" />
              <span className="flex-1">
                <span className="flex items-center gap-2 whitespace-nowrap text-[16px]">{online ? tx("online_title") : l.name}{l.show_new_label && <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] text-primary-foreground">{tx("new")}</span>}</span>
                <span className="block text-[13px] text-muted-foreground">{online ? tx("online_sub") : l.address}</span>
              </span>
              <Chevron />
            </button>
          );
        })}
      </div>
    </>
  );
}

function Avatar({ src, size = 56 }: { src: string | null; size?: number }) {
  return src ? <img src={src} alt="" className="shrink-0 rounded-full border-2 border-background object-cover" style={{ width: size, height: size }} />
    : <span className="shrink-0 rounded-full border-2 border-background bg-muted" style={{ width: size, height: size }} />;
}

const addDays = (date: string, n: number) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

function useSlots(c: Full, s: Search, treatmentId: string, locationId: string, practitionerIds: string[], from: string, days: number) {
  const fn = useServerFn(getBookingSlots);
  return useQuery({
    queryKey: ["booking-slots", s.merk ?? "", treatmentId, locationId, practitionerIds.join(","), from, days],
    queryFn: () => fn({ data: { merk: s.merk, treatmentId, locationId, practitionerIds, from, days } }),
    enabled: !!c,
  });
}

const todayLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" });

function PractitionerStep({ c, s, treatmentId, locationId, required, tx, onPick }: { c: Full; s: Search; treatmentId: string; locationId: string; required: boolean; tx: Tx; onPick: (p: string) => void }) {
  const [all, setAll] = useState(false);
  const people = eligiblePractitioners(c, treatmentId, locationId);
  const today = todayLocal();
  const q = useSlots(c, s, treatmentId, locationId, [], today, c.maxAheadWeeks * 7);
  const first = (pid: string | null) => {
    const list = pid ? q.data?.perPractitioner[pid] : q.data?.merged;
    return list?.[0]?.date ?? null;
  };
  const when = (d: string | null) => (d === null ? tx("earliest_none") : d === today ? tx("earliest_today") : daysBetween(today, d) === 1 ? tx("earliest_tomorrow") : tx("earliest_days", { n: daysBetween(today, d) }));
  const sorted = [...people].sort((a, b) => (first(a.id) ?? "9999").localeCompare(first(b.id) ?? "9999") || a.last_name.localeCompare(b.last_name, "nl"));
  const shown = all ? sorted : sorted.slice(0, 3);
  const locName = (pid: string) => c.practitionerLocations.filter((x) => x.practitioner_id === pid).map((x) => c.locations.find((l) => l.id === x.location_id)).filter((l) => l && l.kind !== "online").map((l) => l?.name).join(" en ");
  return (
    <>
      <Title sub={required ? tx("who_required_help") : tx("who_help")}>{tx("q_who")}</Title>
      <p className="mb-2 text-[12px] text-muted-foreground">{tx("sorted_first_free")}</p>
      <div className="flex flex-col gap-2">
        {!required && (
          <Card onClick={() => onPick("any")} avatar={<span className="flex size-[52px] items-center justify-center rounded-full bg-background"><img src="/ui-icons/team.svg" alt="" className="size-5" /></span>}
            title={tx("no_preference")} sub={tx("no_preference_help")} when={q.isLoading ? "" : when(first(null))} />
        )}
        {shown.map((p) => (
          <Card key={p.id} onClick={() => onPick(p.id)} avatar={<Avatar src={p.photo} size={52} />} title={`${p.first_name} ${p.last_name}`}
            sub={[roleName(c, p.role_id), locName(p.id)].filter(Boolean).join(" · ")} when={q.isLoading ? "" : when(first(p.id))} />
        ))}
      </div>
      {!all && sorted.length > 3 && <button type="button" onClick={() => setAll(true)} className="mt-5 self-center text-[14px] text-primary underline">{tx("show_all", { n: sorted.length })}</button>}
    </>
  );
}

function Card({ avatar, title, sub, when, onClick }: { avatar: React.ReactNode; title: string; sub: string; when: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-4 rounded-[16px] bg-sand px-4 py-4 text-left">
      {avatar}
      <span className="min-w-0 flex-1">
        <span className="block text-[16px]">{title}</span>
        <span className="block text-[13px] leading-[1.5] text-muted-foreground">{sub}</span>
        {when && <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-primary"><img src="/ui-icons/kalender.svg" alt="" className="size-3.5" />{when}</span>}
      </span>
      <Chevron />
    </button>
  );
}

function PlannerStep({ c, s, step, tx, lang, go }: { c: Full; s: Search; step: Extract<ReturnType<typeof nextStep>, { kind: "planner" }>; tx: Tx; lang: string; go: (p: Partial<Search>, replace?: boolean) => void }) {
  const today = todayLocal();
  const horizon = c.maxAheadWeeks * 7;
  const q = useSlots(c, s, step.treatment, step.location, step.practitioner ? [step.practitioner] : [], today, horizon);
  const slots: Slot[] = useMemo(() => (step.practitioner ? q.data?.perPractitioner[step.practitioner] ?? [] : q.data?.merged ?? []), [q.data, step.practitioner]);
  const firstFree = slots[0]?.date ?? null;
  const selected = s.d ?? firstFree ?? today;
  const weekStart = addDays(selected, -((daysBetween("2024-01-01", selected) % 7 + 7) % 7) - 2 + 0);
  const start = weekStart < today ? today : weekStart;
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const daySlots = slots.filter((x) => x.date === selected);
  const nextAfter = slots.find((x) => x.date > selected)?.date ?? null;
  const fmt = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { timeZone: "UTC", ...o });
  const chosen = s.tijd ? daySlots.find((x) => fmtTime(x.start) === s.tijd) : undefined;
  const p = step.practitioner ? c.practitioners.find((x) => x.id === step.practitioner) : null;
  const roles = [...new Set(c.treatmentRoles.filter((x) => x.treatment_id === step.treatment).map((x) => roleName(c, x.role_id, lang)))];
  const roleLabel = roles.length === 1 ? (roles[0] ?? "") : tx("practitioner");
  return (
    <>
      <Title>{tx("q_when")}</Title>
      {step.canChoose && (
        <button type="button" onClick={() => go({ stap: "wie" })} className="mb-6 flex items-center gap-3 rounded-[16px] bg-sand px-4 py-3 text-left">
          {p ? <Avatar src={p.photo} size={40} /> : <span className="flex size-10 items-center justify-center rounded-full bg-background"><img src="/ui-icons/team.svg" alt="" className="size-5" /></span>}
          <span className="flex-1"><span className="block text-[12px] text-muted-foreground">{roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1)}</span><span className="block text-[15px]">{p ? `${p.first_name} ${p.last_name}` : tx("no_preference")}</span></span>
          <span className="flex items-center gap-1 whitespace-nowrap text-[14px] text-primary">{tx("choose", { rol: roleLabel.toLowerCase() })}<Chevron /></span>
        </button>
      )}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[15px] font-semibold capitalize">{fmt(start, { month: "long", year: "numeric" })}</span>
        <span className="flex gap-2">
          <button type="button" aria-label="Vorige week" disabled={start <= today} onClick={() => go({ d: addDays(start, -7) < today ? today : addDays(start, -7), tijd: undefined }, true)} className="flex size-9 items-center justify-center rounded-full disabled:opacity-30"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <button type="button" aria-label="Volgende week" disabled={daysBetween(today, addDays(start, 7)) > horizon} onClick={() => go({ d: addDays(start, 7), tijd: undefined }, true)} className="flex size-9 items-center justify-center rounded-full bg-sand disabled:opacity-30"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
        </span>
      </div>
      <div className="mb-6 grid grid-cols-7 gap-1 text-center">
        {days.map((d) => {
          const has = slots.some((x) => x.date === d);
          const on = d === selected;
          return (
            <button key={d} type="button" disabled={!has} onClick={() => go({ d, tijd: undefined }, true)} className="flex flex-col items-center gap-1.5 disabled:opacity-40">
              <span className={cn("text-[12px]", on ? "font-semibold text-primary" : "text-muted-foreground")}>{fmt(d, { weekday: "short" }).slice(0, 2)}</span>
              <span className={cn("flex size-10 items-center justify-center rounded-full text-[15px]", on ? "bg-primary text-primary-foreground" : has ? "bg-sand" : "")}>{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>
      <p className="mb-3 text-[15px] font-semibold first-letter:uppercase">{fmt(selected, { weekday: "long", day: "numeric", month: "long" })}</p>
      {q.isLoading ? <div className="h-40 animate-pulse rounded-[16px] bg-sand" /> : slots.length === 0 ? (
        <p className="text-[15px] leading-[1.6]">{tx("no_times_period")}</p>
      ) : (
        <>
          {(["morning", "afternoon", "evening"] as const).map((part) => {
            const list = daySlots.filter((x) => dayPart(x.start) === part);
            return (
              <div key={part} className="mb-4">
                <p className="mb-2 text-[13px] text-muted-foreground">{tx(part)}</p>
                {list.length === 0 ? <p className="text-[14px]">{tx("no_times_day")}</p> : (
                  <div className="grid grid-cols-4 gap-2">
                    {list.map((x) => {
                      const t = fmtTime(x.start);
                      return <button key={t} type="button" onClick={() => go({ tijd: t }, true)} className={cn("h-12 rounded-[12px] text-[15px]", s.tijd === t ? "bg-primary text-primary-foreground" : "bg-sand")}>{t}</button>;
                    })}
                  </div>
                )}
              </div>
            );
          })}
          {daySlots.length === 0 && nextAfter && (
            <button type="button" onClick={() => go({ d: nextAfter, tijd: undefined }, true)} className="mt-2 rounded-[14px] bg-teal-light px-4 py-3 text-left text-[14px] text-primary">
              {tx("go_next_free", { when: fmt(nextAfter, { weekday: "long", day: "numeric", month: "long" }) })}
            </button>
          )}
        </>
      )}
      <div className="flex-1" />
      {chosen && (
        <div className="sticky bottom-0 -mx-5 mt-6 border-t border-line bg-background px-5 pb-2 pt-4">
          <PillButton size="lg" className="w-full" onClick={() => go({ stap: "vasthouden", d: selected })}>
            {tx("continue_with", { when: `${fmt(selected, { weekday: "short", day: "numeric", month: "short" })}, ${s.tijd}` })}
          </PillButton>
        </div>
      )}
    </>
  );
}

const ANSWERS_KEY = "tbc-booking-answers";
const HOLD_KEY = "tbc-booking-hold";
const readJson = <T,>(k: string): T | null => { try { return JSON.parse(sessionStorage.getItem(k) ?? "null") as T; } catch { return null; } };

/** Holds the chosen time, runs the triage while the hold lasts, and handles expiry and red outcomes. */
function HoldStep({ c, s, treatmentId, locationId, practitionerId, tx, lang, go }: { c: Full; s: Search; treatmentId: string; locationId: string; practitionerId: string; tx: Tx; lang: string; go: (p: Partial<Search>, replace?: boolean) => void }) {
  const hold = useServerFn(holdSlot);
  const release = useServerFn(releaseHold);
  const triageFn = useServerFn(getTriage);
  const treatment = c.treatments.find((x) => x.id === treatmentId);
  const triageKey = treatment?.pre_questionnaire_key ?? null;
  const triage = useQuery({ queryKey: ["booking-triage", s.merk ?? "", triageKey], queryFn: () => triageFn({ data: { merk: s.merk, key: triageKey ?? "" } }), enabled: !!triageKey, staleTime: 60_000 });
  const [state, setState] = useState<{ kind: "loading" } | { kind: "taken" } | { kind: "held"; token: string; expiresAt: number; minutes: number } | { kind: "expired"; minutes: number } | { kind: "done" }>({ kind: "loading" });
  const [initial, setInitial] = useState<Answers | null>(null);
  const started = useRef(false);
  const rejected = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setInitial(readJson<Answers>(ANSWERS_KEY) ?? {});
    const prev = readJson<{ token: string }>(HOLD_KEY);
    hold({ data: { merk: s.merk, treatmentId, locationId, practitionerId, date: s.d ?? "", time: s.tijd ?? "", language: lang === "en" ? "en" : "nl", source: s.bron, replaceToken: prev?.token } }).then((r) => {
      if (!r.ok) { setState({ kind: "taken" }); return; }
      sessionStorage.setItem(HOLD_KEY, JSON.stringify({ token: r.token, expiresAt: r.expiresAt }));
      setState({ kind: "held", token: r.token, expiresAt: Date.parse(r.expiresAt), minutes: r.holdMinutes });
    }, () => setState({ kind: "taken" }));
  }, [hold, s, treatmentId, locationId, practitionerId, lang]);

  useEffect(() => {
    if (state.kind !== "held") return;
    const id = window.setInterval(() => { if (!rejected.current && Date.now() >= state.expiresAt) setState({ kind: "expired", minutes: state.minutes }); }, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const keep = useCallback((a: Answers) => sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(a)), []);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const loc = c.locations.find((l) => l.id === locationId);
  const choice = `${fmt(s.d ?? "")}, ${s.tijd} · ${loc?.kind === "online" ? tx("online_word") : loc?.name ?? ""}`;
  const again = () => go({ stap: undefined, tijd: undefined });

  if (state.kind === "taken") return (
    <Shell lang={lang} progress={0.45} onBack={again} footer={<PillButton size="lg" className="w-full" onClick={again}>{tx("choose_again")}</PillButton>}>
      <p className="text-[15px] leading-[1.6]">{tx("slot_taken")}</p>
    </Shell>
  );
  if (state.kind === "expired") return (
    <Shell lang={lang} progress={0.6} onBack={again} footer={<PillButton size="lg" className="w-full" onClick={again}>{tx("choose_again")}</PillButton>}>
      <Title sub={tx("expired_body", { min: state.minutes })}>{tx("expired_title")}</Title>
      <div className="rounded-[18px] bg-sand p-5">
        <p className="text-[13px] text-muted-foreground">{tx("your_choice")}</p>
        <p className="mt-2 text-[15px] font-semibold first-letter:uppercase">{choice}</p>
        <p className="mt-3 flex items-center gap-2 text-[14px]"><img src="/ui-icons/vinkje.svg" alt="" className="size-4" />{tx("answers_kept")}</p>
      </div>
    </Shell>
  );
  if (state.kind === "loading" || initial === null || (triageKey && triage.isLoading)) return <Shell lang={lang} progress={0.5}><div className="h-40 animate-pulse rounded-[16px] bg-sand" /></Shell>;
  if (state.kind === "done" || !triageKey || !triage.data) return (
    // Details form and confirmation follow in the next build step.
    <Shell lang={lang} progress={0.7} onBack={again}><Title>{tx("step_details")}</Title></Shell>
  );
  const ui = Object.fromEntries(c.ui.filter((u) => u.list_key === "questionnaire_ui").map((u) => [u.value, (lang === "en" && u.label_en) || u.label_nl]));
  const p = c.practitioners.find((x) => x.id === practitionerId);
  return (
    <QuestionnaireRunner fullScreen flow={triage.data.flow as unknown as FlowFile} def={triage.data.definition as unknown as QuestionnaireDef} ui={ui} today={todayLocal()} initial={initial}
      vars={{ dag: fmt(s.d ?? ""), tijd: s.tijd ?? "", behandelaar_voornaam: p?.first_name ?? "", voornaam: "" }}
      onAnswers={keep}
      onRed={(red) => { rejected.current = true; sessionStorage.removeItem(ANSWERS_KEY); sessionStorage.removeItem(HOLD_KEY); void release({ data: { merk: s.merk, token: state.token, questionnaire: triageKey, reason: red.reason } }); }}
      onFinish={(a) => { keep(a); setState({ kind: "done" }); }} />
  );
}
