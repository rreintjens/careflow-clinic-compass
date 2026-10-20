import { useQuery, useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";

import { resolveStartScreen,startScreenPage } from "@/domain/start-screen";
import { Boodschap } from "@/features/questionnaire/QuestionnaireRunner";
import { Logo } from "@/components/Logo";
import { PatientFrame } from "@/components/PatientFrame";
import { PillButton } from "@/components/PillButton";
import { dayPart, nextStep, sortLocations, type Catalog } from "@/domain/booking";
import { fmtTime, type Slot } from "@/domain/slots";
import { cn } from "@/lib/utils";
import { confirmBooking, getBookingCatalog, getBookingSlots, getTriage, holdSlot, lookupAddress, releaseHold } from "@/data/booking.functions";
import { getBookingLink } from "@/data/booking-links.functions";
import type { ChoiceMode } from "@/domain/booking";
import { DobField, QuestionnaireRunner } from "@/features/questionnaire/QuestionnaireRunner";
import { Select } from "@/components/Select";
import { TextArea, TextField } from "@/components/Field";
import type { Answers, FlowFile, QuestionnaireDef } from "@/domain/questionnaire/engine";
import { supabase } from "@/integrations/supabase/client";
import { bookingPatientContext, sendPortalLink } from "@/data/portal.functions";
import { patientInitials } from "@/domain/portal";
import { UserRound, Mail } from "lucide-react";

const search = z.object({
  merk: z.string().optional(), lang: z.enum(["nl", "en"]).optional(), bron: z.string().optional(), link: z.string().optional(),
  utm_source: z.string().max(80).optional(), utm_medium: z.string().max(80).optional(), utm_campaign: z.string().max(80).optional(),
  cat: z.string().optional(), sub: z.string().optional(), t: z.string().optional(), l: z.string().optional(),
  p: z.string().optional(), d: z.string().optional(), tijd: z.string().optional(), stap: z.string().optional(),
  inloggen: z.enum(["nee"]).optional(),
});
type Search = z.infer<typeof search>;

const MODES = new Set<string>(["assigned", "optional", "required", "fixed"]);

const catalogQuery = (merk: string | undefined) => queryOptions({ queryKey: ["booking-catalog", merk ?? ""], queryFn: () => getBookingCatalog({ data: { merk } }), staleTime: 60_000 });

export const Route = createFileRoute("/boeken")({
  validateSearch: search,
  loaderDeps: ({ search: s }) => ({ merk: s.merk, link: s.link }),
  loader: async ({ deps }) => {
    const catalog=await getBookingCatalog({data:{merk:deps.merk}});
    const link=deps.link?await getBookingLink({data:{merk:deps.merk,link:deps.link}}):null;
    return {catalog,link};
  },
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
  const loaded=Route.useLoaderData();
  const data=loaded.catalog;
  const linkRes={data:loaded.link};
  const link = linkRes.data?.found ? linkRes.data.link : null;
  const lang = s.lang ?? link?.language ?? "nl";
  const tx = (key: string, vars: Record<string, string | number> = {}) => {
    const r = data.ui.find((u) => (u.list_key === "booking_ui" || u.list_key === "questionnaire_ui") && u.value === key);
    const base = (lang === "en" && r?.label_en) || r?.label_nl || "";
    return base.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  };
  const go = (patch: Partial<Search>, replace = false) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace });

  // One tap may never advance more than one step: ignore touches for ~400 ms after a step change,
  // so a tap that started on the previous screen cannot land on a button of the new screen.
  const [startPassed,setStartPassed]=useState(false);
  const stepKey = `${s.cat ?? ""}|${s.sub ?? ""}|${s.t ?? ""}|${s.l ?? ""}|${s.p ?? ""}|${s.stap ?? ""}`;
  const [settling, setSettling] = useState(true);
  useEffect(() => {
    setSettling(true);
    const t = window.setTimeout(() => setSettling(false), 400);
    return () => window.clearTimeout(t);
  }, [stepKey]);
  const guard = settling ? "pointer-events-none" : undefined;

  // A Mijn omgeving session hides the login bar, presets the patient's own practitioner and prefills the details.
  const [me, setMe] = useState<Awaited<ReturnType<typeof bookingPatientContext>> | null>(null);
  useEffect(() => {
    let on = true;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !on) return;
      try { const r = await bookingPatientContext({ data: { merk: s.merk } }); if (on && r.patient) setMe(r); } catch { /* not a patient session */ }
    })();
    return () => { on = false; };
  }, [s.merk]);

  if (!("categories" in data) || !data.tenant) return <Shell lang={lang} onLang={() => go({ lang: lang === "nl" ? "en" : "nl" })}><p className="pt-10 text-[15px]">{tx("unknown_brand")}</p></Shell>;
  const original = data as Full;
  const c: Full = link ? {...original,treatments:original.treatments.filter(t=>link.treatmentIds.includes(t.id)),practitioners:original.practitioners.filter(p=>!link.practitionerIds||link.practitionerIds.includes(p.id))} : original;
  const name = (x: { name_nl: string; name_en: string | null }) => (lang === "en" && x.name_en) || x.name_nl;
  /** Icon with fallback up the tree: subcategory → parent category, treatment → its (sub)category. */
  const catIcon = (id: string | null | undefined): string | null | undefined => {
    const x = c.categories.find((k) => k.id === id);
    return x?.icon ?? (x?.parent_id ? catIcon(x.parent_id) : undefined);
  };
  const allowed = link ? new Set(link.locationIds) : null;
  const mode = link?.practitionerMode && MODES.has(link.practitionerMode) ? (link.practitionerMode as ChoiceMode) : null;
  const locationsFor = (tid: string) => c.treatmentLocations.filter((x) => x.treatment_id === tid && c.locations.some((l) => l.id === x.location_id) && (!allowed || allowed.has(x.location_id))).map((x) => x.location_id);
  const treatments = (link?.treatmentId ? c.treatments.filter((t) => t.id === link.treatmentId) : c.treatments).map((t) => (mode ? { ...t, practitioner_choice: mode } : t));
  const catalog: Catalog = { categories: c.categories, links: link?.treatmentId ? c.links.filter((x) => x.treatment_id === link.treatmentId) : c.links, treatments, locationsFor };
  // Bron: een eigen ?bron= wint, dan de bron van de boekingslink, dan de utm-bron uit het webadres.
  const eff: Search = link
    ? { ...s, t: s.t ?? link.treatmentId ?? undefined, p: link.practitionerId ?? (s.p && s.p!=="any" && link.practitionerIds && !link.practitionerIds.includes(s.p) ? undefined : s.p), bron: s.bron ?? (link.source || undefined) ?? s.utm_source }
    : { ...s, bron: s.bron ?? s.utm_source };
  let step = nextStep(catalog, eff);
  if(startPassed&&link?.treatmentId&&!s.l&&!s.stap) step={kind:"location",treatment:link.treatmentId,options:locationsFor(link.treatmentId)};
  if (step.kind === "practitioner") {
    const people = eligiblePractitioners(c,step.treatment,step.location);
    if (people.length === 1) step = nextStep(catalog,{...eff,p:people[0]?.id});
  }
  const progress = { category: 0.1, subcategory: 0.15, treatment: 0.2, location: 0.3, practitioner: 0.4, planner: 0.45, none: 0 }[step.kind];
  const back = step.kind === "category" ? undefined : () => window.history.back();
  const close = () => navigate({ search: { merk: s.merk, lang: s.lang, bron: s.bron } });
  const phone = c.tenant.phone;

  const startTreatment=c.treatments.find(t=>t.id===link?.treatmentId);
  const startScreen=resolveStartScreen(link?{treatmentId:link.treatmentId,mode:link.startScreenMode,screen:link.startScreen}:null,startTreatment?.start_screen);
  if(startScreen&&!startPassed&&!s.tijd&&!s.stap) {const page=startScreenPage(startScreen,lang);const people=c.practitioners.filter(p=>c.practitionerTreatments.some(pt=>pt.practitioner_id===p.id&&pt.treatment_id===startTreatment?.id));return <Shell lang={lang} footer={<PillButton size="lg" className="patient-choice choice-primary w-full" onClick={()=>setStartPassed(true)}>{page.button}</PillButton>}><Title>{page.title}</Title><p className="text-[15px] leading-relaxed">{page.body}</p>{startScreen.form==="practitioner"?<div className="mt-5 grid grid-cols-2 gap-4">{people.map(p=><div key={p.id} className="flex items-center gap-3"><Avatar src={p.photo} size={40}/><span className="text-sm">{p.first_name} {p.last_name}</span></div>)}</div>:<Boodschap page={page} vars={{}}/>}<div className="mt-6 flex items-center gap-3"><div className="flex -space-x-2">{people.slice(0,4).map(p=><Avatar key={p.id} src={p.photo} size={32}/>)}</div><span className="text-sm text-muted-foreground">{tx("duration_line",{rol:"arts",min:startTreatment?.duration_min??30})}</span></div></Shell>;}
  if (step.kind === "planner" && s.stap === "vasthouden" && s.d && s.tijd) {
    return <div className={guard}><HoldStep c={c} s={eff} treatmentId={step.treatment} locationId={step.location} practitionerId={step.practitioner ?? "any"} tx={tx} lang={lang} go={go} /></div>;
  }

  return (
    <Shell lang={lang} progress={progress} onBack={back} onClose={close} onLang={step.kind === "category" ? () => go({ lang: lang === "nl" ? "en" : "nl" }, true) : undefined}
      footer={step.kind === "category" && phone ? <p className="text-center text-[13px] text-muted-foreground">{tx("call")} <a href={`tel:${phone}`} className="text-primary underline">{phone}</a></p> : null}>
      <div className={guard}>
      {step.kind === "none" && <p className="pt-10 text-[15px]">{tx("nothing_bookable")}</p>}
      {step.kind === "category" && (
        <List title={tx("q_category")} rows={step.options.map((id) => { const x = c.categories.find((k) => k.id === id); return { id, title: x ? name(x) : "", icon: x?.icon }; })} onPick={(id) => go({ cat: id })} />
      )}
      {step.kind === "subcategory" && (
        <List title={name(c.categories.find((k) => k.id === step.category) ?? { name_nl: "", name_en: null })} rows={step.options.map((id) => { const x = c.categories.find((k) => k.id === id); return { id, title: x ? name(x) : "", icon: x?.icon ?? catIcon(x?.parent_id) }; })} onPick={(id) => go({ sub: id })} />
      )}
      {step.kind === "treatment" && (
        <List title={tx("q_treatment")} rows={step.options.map((id) => { const x = c.treatments.find((k) => k.id === id); return { id, title: x ? name(x) : "", sub: x ? `${x.duration_min} min` : "", icon: x?.icon ?? catIcon(step.category) }; })} onPick={(id) => go({ t: id })} />
      )}
      {step.kind === "location" && <LocationStep c={c} treatmentId={step.treatment} options={step.options} hidePeople={!!startScreen} tx={tx} name={name} onPick={(id) => go({ l: id })} />}
      {step.kind === "practitioner" && <PractitionerStep c={c} s={s} treatmentId={step.treatment} locationId={step.location} required={step.required} tx={tx} onPick={(p) => go({ p, stap: undefined, tijd: undefined })} />}
      {step.kind === "planner" && <PlannerStep c={c} s={s} step={step} tx={tx} lang={lang} go={go} />}
      </div>
    </Shell>
  );
}

function Shell({ children, footer, progress = 0, onBack, onClose, onLang, lang }: { children: React.ReactNode; footer?: React.ReactNode; progress?: number; onBack?: (() => void) | undefined; onClose?: () => void; onLang?: (() => void) | undefined; lang: string }) {
  return (
    <PatientFrame>
        <header className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-2">
          {onLang ? <button type="button" onClick={onLang} className="text-[13px] font-semibold text-primary">{lang === "nl" ? "EN" : "NL"}</button>
            : onBack ? <button type="button" onClick={onBack} aria-label="Terug" className="flex justify-center"><img src="/ui-icons/pijl-links.svg" alt="" className="size-5" /></button> : <span />}
          <span className="flex justify-center"><span className="sm:hidden"><Logo small /></span><span className="hidden sm:inline-flex"><Logo mark /></span></span>
          {onClose ? <button type="button" onClick={onClose} aria-label="Sluiten" className="flex justify-center"><img src="/ui-icons/kruis.svg" alt="" className="size-5" /></button> : <span />}
        </header>
        <div className="h-[3px] bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <main className="flex flex-1 flex-col px-5 pb-6 pt-8">{children}</main>
        {footer && <footer className="px-5 pb-6">{footer}</footer>}
    </PatientFrame>
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
          <button key={r.id} type="button" onClick={() => onPick(r.id)} className="patient-choice flex min-h-[60px] items-center gap-4 rounded-[16px] bg-sand px-5 text-left">
            {r.icon ? <span className="flex size-8 shrink-0 items-center justify-center"><img src={`/treatment-icons/${r.icon}.png`} alt="" className="size-7" /></span> : null}
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

function LocationStep({ c, treatmentId, options, tx, name, onPick,hidePeople=false }: { c: Full; treatmentId: string; options: string[];hidePeople?:boolean; tx: Tx; name: (x: { name_nl: string; name_en: string | null }) => string; onPick: (id: string) => void }) {
  const t = c.treatments.find((x) => x.id === treatmentId);
  const locs = sortLocations(c.locations.filter((l) => options.includes(l.id)));
  const roles = [...new Set(c.treatmentRoles.filter((x) => x.treatment_id === treatmentId).map((x) => roleName(c, x.role_id).toLowerCase()))];
  const people = c.practitioners.filter((p) => c.practitionerTreatments.some((x) => x.practitioner_id === p.id && x.treatment_id === treatmentId)).slice(0, 3);
  return (
    <>
      <Title sub={!hidePeople && t && (
        <span className="flex items-center gap-3">
          <span className="flex -space-x-3">{people.map((p) => <Avatar key={p.id} src={p.photo} size={40} />)}</span>
          <span>{tx("duration_line", { rol: roles.length === 1 ? roles[0] ?? "" : tx("practitioner"), min: t.duration_min })}</span>
        </span>
      )}>{tx("q_location")}</Title>
      <div className="flex flex-col gap-2">
        {locs.map((l, i) => {
          const online = l.kind === "online";
          return (
            <button key={l.id} type="button" onClick={() => onPick(l.id)} className={cn("patient-choice relative flex min-h-[64px] items-center gap-4 rounded-[16px] px-5 py-3 text-left", online && i === 0 ? "choice-recommended" : "bg-sand")}>
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
    queryFn: () => fn({ data: { merk: s.merk, treatmentId, locationId, practitionerIds: practitionerIds.length ? practitionerIds : eligiblePractitioners(c,treatmentId,locationId).map(p=>p.id), from, days, link:s.link } }),
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
        {(
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
    <button type="button" onClick={onClick} className="patient-choice flex items-center gap-4 rounded-[16px] bg-sand px-4 py-4 text-left">
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
        <button type="button" onClick={() => go({ stap: "wie" })} className="patient-choice mb-6 flex items-center gap-3 rounded-[16px] bg-sand px-4 py-3 text-left">
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
            <button key={d} type="button" disabled={!has} onClick={() => go({ d, tijd: undefined }, true)} aria-pressed={selected===d} className="patient-choice patient-day rounded-[12px] px-1 flex flex-col items-center gap-1.5 disabled:opacity-40">
              <span className={cn("text-[12px]", on ? "font-semibold text-primary" : "text-muted-foreground")}>{fmt(d, { weekday: "short" }).slice(0, 2)}</span>
              <span className={cn("day-circle flex size-10 items-center justify-center rounded-full text-[15px]", on ? "bg-primary text-primary-foreground" : has ? "bg-sand" : "")}>{Number(d.slice(8))}</span>
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
                      return <button key={t} type="button" onClick={() => go({ tijd: t }, true)} aria-pressed={s.tijd===t} className="patient-choice h-12 rounded-[12px] text-[15px]">{t}</button>;
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
          <PillButton size="lg" className="patient-choice choice-primary w-full" onClick={() => go({ stap: "vasthouden", d: selected })}>
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
  const [state, setState] = useState<{ kind: "loading" } | { kind: "taken" } | { kind: "held"; token: string; expiresAt: number; minutes: number; practitionerId: string } | { kind: "expired"; minutes: number }>({ kind: "loading" });
  const [initial, setInitial] = useState<Answers | null>(null);
  const [phase, setPhase] = useState<"triage" | "details" | "confirmed">("triage");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const [meet, setMeet] = useState<string | null>(null);
  const started = useRef(false);
  const rejected = useRef(false);
  const confirmedRef = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    setInitial(readJson<Answers>(ANSWERS_KEY) ?? {});
    const prev = readJson<{ token: string }>(HOLD_KEY);
    hold({ data: { merk: s.merk, treatmentId, locationId, practitionerId, date: s.d ?? "", time: s.tijd ?? "", language: lang === "en" ? "en" : "nl", source: s.bron, link: s.link, replaceToken: prev?.token } }).then((r) => {
      if (!r.ok) { setState({ kind: "taken" }); return; }
      sessionStorage.setItem(HOLD_KEY, JSON.stringify({ token: r.token, expiresAt: r.expiresAt }));
      setState({ kind: "held", token: r.token, expiresAt: Date.parse(r.expiresAt), minutes: r.holdMinutes, practitionerId: r.practitionerId });
    }, () => setState({ kind: "taken" }));
  }, [hold, s, treatmentId, locationId, practitionerId, lang]);

  useEffect(() => {
    if (state.kind !== "held") return;
    const id = window.setInterval(() => { if (!rejected.current && !confirmedRef.current && Date.now() >= state.expiresAt) setState({ kind: "expired", minutes: state.minutes }); }, 1000);
    return () => window.clearInterval(id);
  }, [state]);

  const keep = useCallback((a: Answers) => sessionStorage.setItem(ANSWERS_KEY, JSON.stringify(a)), []);
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const loc = c.locations.find((l) => l.id === locationId);
  const choice = `${fmt(s.d ?? "")}, ${s.tijd} · ${loc?.kind === "online" ? tx("online_word") : loc?.name ?? ""}`;
  const again = () => go({ stap: undefined, tijd: undefined });

  if (state.kind === "taken") return (
    <Shell lang={lang} progress={0.45} onBack={again} footer={<PillButton size="lg" className="patient-choice choice-primary w-full" onClick={again}>{tx("choose_again")}</PillButton>}>
      <p className="text-[15px] leading-[1.6]">{tx("slot_taken")}</p>
    </Shell>
  );
  if (state.kind === "expired") return (
    <Shell lang={lang} progress={0.6} onBack={again} footer={<PillButton size="lg" className="patient-choice choice-primary w-full" onClick={again}>{tx("choose_again")}</PillButton>}>
      <Title sub={tx("expired_body", { min: state.minutes })}>{tx("expired_title")}</Title>
      <div className="rounded-[18px] bg-sand p-5">
        <p className="text-[13px] text-muted-foreground">{tx("your_choice")}</p>
        <p className="mt-2 text-[15px] font-semibold first-letter:uppercase">{choice}</p>
        <p className="mt-3 flex items-center gap-2 text-[14px]"><img src="/ui-icons/vinkje.svg" alt="" className="size-4" />{tx("answers_kept")}</p>
      </div>
    </Shell>
  );
  if (state.kind === "loading" || initial === null || (triageKey && triage.isLoading && phase === "triage")) return <Shell lang={lang} progress={0.5}><div className="h-40 animate-pulse rounded-[16px] bg-sand" /></Shell>;
  if (phase === "confirmed" && confirmed) return <ConfirmedStep c={c} s={s} treatmentId={treatmentId} locationId={locationId} practitionerId={state.kind === "held" ? state.practitionerId : practitionerId} manageToken={confirmed} meetLink={meet} tx={tx} lang={lang} />;
  if (state.kind === "held" && (phase === "details" || !triageKey || !triage.data)) return (
    <DetailsStep c={c} s={s} token={state.token} treatmentId={treatmentId} locationId={locationId} practitionerId={state.practitionerId} tx={tx} lang={lang} again={again}
      triageKey={triageKey} triageVersionId={triage.data?.versionId} triageAnswers={readJson<Answers>(ANSWERS_KEY) ?? undefined}
      onExpired={() => setState({ kind: "expired", minutes: state.minutes })}
      onDone={(m, meeting) => { confirmedRef.current = true; sessionStorage.removeItem(ANSWERS_KEY); sessionStorage.removeItem(HOLD_KEY); setConfirmed(m); setMeet(meeting ?? null); setPhase("confirmed"); }} />
  );
  if (state.kind !== "held" || !triage.data) return null;
  const ui = Object.fromEntries(c.ui.filter((u) => u.list_key === "questionnaire_ui").map((u) => [u.value, (lang === "en" && u.label_en) || u.label_nl]));
  const p = c.practitioners.find((x) => x.id === practitionerId);
  return (
    <QuestionnaireRunner fullScreen flow={triage.data.flow as unknown as FlowFile} def={triage.data.definition as unknown as QuestionnaireDef} ui={ui} today={todayLocal()} initial={initial}
      vars={{ dag: fmt(s.d ?? ""), tijd: s.tijd ?? "", behandelaar_voornaam: p?.first_name ?? "", behandelaar_naam: p ? `${p.first_name} ${p.last_name}` : "", behandelaar_foto: p?.photo ?? "", behandelaar_tekst: p?.bio ?? "", voornaam: "" }}
      onAnswers={keep}
      onRed={(red) => { rejected.current = true; sessionStorage.removeItem(ANSWERS_KEY); sessionStorage.removeItem(HOLD_KEY); void release({ data: { merk: s.merk, token: state.token, questionnaire: triageKey ?? undefined, reason: red.reason } }); }}
      onFinish={(a) => { keep(a); setPhase("details"); }} />
  );
}

const opt = (c: Full, list: string, lang: string) => c.ui.filter((u) => u.list_key === list).map((u) => ({ value: u.value, label: (lang === "en" && u.label_en) || u.label_nl }));
const fmtLong = (d: string, lang: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === "en" ? "en-GB" : "nl-NL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

function AppointmentSummary({ c, s, treatmentId, locationId, practitionerId, tx, lang, onChange }: { c: Full; s: Search; treatmentId: string; locationId: string; practitionerId: string; tx: Tx; lang: string; onChange?: () => void }) {
  const t = c.treatments.find((x) => x.id === treatmentId);
  const l = c.locations.find((x) => x.id === locationId);
  const p = c.practitioners.find((x) => x.id === practitionerId);
  const tName = t ? ((lang === "en" && t.name_en) || t.name_nl) : "";
  return (
    <div className="rounded-[18px] bg-teal-light p-4">
      <p className="text-[12px] text-primary">{tx("d_your_appt")}</p>
      <p className="mt-1 text-[16px] font-semibold first-letter:uppercase">{fmtLong(s.d ?? "", lang)}, {s.tijd}</p>
      <p className="mt-1 text-[14px]">{tName}, {tx("c_minutes", { min: t?.duration_min ?? 0 })}</p>
      <p className="text-[14px]">{[l?.kind === "online" ? tx("d_online_meet") : l?.name, p ? `${p.first_name} ${p.last_name}` : ""].filter(Boolean).join(" · ")}</p>
      {onChange && <button type="button" onClick={onChange} className="mt-2 text-[13px] text-primary underline">{tx("d_change")}</button>}
    </div>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-[14px] leading-[1.5]">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={cn("mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-[6px] border peer-focus-visible:ring-2 peer-focus-visible:ring-ring", checked ? "border-primary bg-primary" : "border-muted-foreground/60 bg-background")}>
        {checked && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>}
      </span>
      <span>{children}</span>
    </label>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) { return <h2 className="mb-3 mt-8 text-[17px] font-semibold">{children}</h2>; }

/** "Je gegevens": one form for new and existing patients; date of birth comes from the triage when asked there. */
function DetailsStep({ c, s, token, treatmentId, locationId, practitionerId, tx, lang, again, triageKey, triageVersionId, triageAnswers, onExpired, onDone }: {
  c: Full; s: Search; token: string; treatmentId: string; locationId: string; practitionerId: string; tx: Tx; lang: string; again: () => void;
  triageKey: string | null; triageVersionId: string | undefined; triageAnswers: Answers | undefined; onExpired: () => void; onDone: (manageToken: string, meetLink: string | null) => void;
}) {
  const confirm = useServerFn(confirmBooking);
  const lookup = useServerFn(lookupAddress);
  const dobFromTriage = typeof triageAnswers?.["date_of_birth"] === "string" ? (triageAnswers["date_of_birth"] as string) : "";
  const [existing, setExisting] = useState(false);
  const [f, setF] = useState({ salutation: opt(c, "salutation", lang)[0]?.value ?? "", firstName: "", lastName: "", dateOfBirth: dobFromTriage, email: "", phoneCountry: opt(c, "phone_country", lang)[0]?.value ?? "", phone: "", country: opt(c, "country", lang)[0]?.value ?? "NL", postcode: "", houseNumber: "", suffix: "", street: "", city: "", referral: "", note: "" });
  const [cons, setCons] = useState({ privacy: false, gp: false, gpName: "", lsp: false, marketing: false });
  const [manual, setManual] = useState(false);
  const [found, setFound] = useState<{ street: string; city: string } | null>(null);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const nl = f.country === "NL";

  useEffect(() => {
    if (!nl || manual || !/^\d{4}\s?[A-Za-z]{2}$/.test(f.postcode.trim()) || !/^\d{1,5}$/.test(f.houseNumber.trim())) { setFound(null); return; }
    const id = window.setTimeout(() => {
      lookup({ data: { postcode: f.postcode.trim(), houseNumber: f.houseNumber.trim(), suffix: f.suffix || undefined } }).then((r) => {
        setFound(r);
        if (r) setF((x) => ({ ...x, street: r.street, city: r.city }));
        else setManual(true);
      }, () => setManual(true));
    }, 400);
    return () => window.clearTimeout(id);
  }, [f.postcode, f.houseNumber, f.suffix, nl, manual, lookup]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim());
  const errs: Record<string, string> = {};
  for (const k of ["firstName", "lastName", "phone", "postcode", "houseNumber", "street", "city"] as const) if (!f[k].trim()) errs[k] = tx("d_required");
  if (!f.dateOfBirth) errs["dateOfBirth"] = tx("d_required");
  if (!f.email.trim()) errs["email"] = tx("d_required"); else if (!emailOk) errs["email"] = tx("d_email_invalid");
  if (!cons.privacy) errs["privacy"] = tx("d_privacy_required");
  const err = (k: string) => (show && errs[k] ? <p role="alert" className="mt-1 text-[13px] text-warning">{errs[k]}</p> : null);

  const submit = async () => {
    setShow(true);
    const first = Object.keys(errs)[0];
    if (first) { document.getElementById(`d-${first}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    setBusy(true); setError("");
    try {
      const r = await confirm({ data: {
        merk: s.merk, token, existing, salutation: f.salutation, firstName: f.firstName, lastName: f.lastName, dateOfBirth: f.dateOfBirth, email: f.email, phoneCountry: f.phoneCountry, phone: f.phone,
        country: f.country, postcode: f.postcode, houseNumber: f.houseNumber, suffix: f.suffix || undefined, street: f.street, city: f.city,
        referral: existing ? undefined : f.referral || undefined, note: f.note || undefined, consentPrivacy: true, consentGp: cons.gp, gpName: cons.gpName || undefined, consentLsp: cons.lsp, consentMarketing: cons.marketing,
        triageKey: triageKey ?? undefined, triageVersionId, triageAnswers,
      } });
      if (r.ok) onDone(r.manageToken, r.meetLink);
      else if (r.reason === "expired") onExpired();
      else setError(r.reason === "young" ? tx("d_dob_young") : tx("d_failed"));
    } catch { setError(tx("d_failed")); } finally { setBusy(false); }
  };
  const privacy = tx("d_c_privacy", { link: "\u0000" }).split("\u0000");

  return (
    <Shell lang={lang} progress={0.85} onBack={again} footer={<>{error && <p role="alert" className="mb-3 text-center text-[14px] text-warning">{error}</p>}<PillButton size="lg" className="patient-choice choice-primary w-full" disabled={busy} onClick={() => void submit()}>{tx("d_submit")}</PillButton></>}>
      <Title sub={!existing ? tx("d_sub") : undefined}>{tx("d_title")}</Title>
      <p className="-mt-2 mb-3 text-[15px]">{tx("d_been_before")}</p>
      <div className="flex gap-2">
        {[false, true].map((v) => (
          <button key={String(v)} type="button" onClick={() => setExisting(v)} aria-pressed={existing===v} className={cn("patient-choice h-11 whitespace-nowrap rounded-full px-5 text-[15px]", existing === v ? "bg-teal-light" : "bg-sand")}>{v ? tx("d_existing") : tx("d_new")}</button>
        ))}
      </div>
      {existing && <p className="mt-4 text-[14px] leading-[1.6] text-muted-foreground">{tx("d_existing_help")}</p>}

      <SectionTitle>{tx("d_about")}</SectionTitle>
      <div className="flex flex-col gap-4">
        <Select label={tx("d_salutation")} value={f.salutation} onChange={(v) => set("salutation", v)} options={opt(c, "salutation", lang)} />
        <div id="d-firstName"><TextField label={tx("d_first")} value={f.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" />{err("firstName")}</div>
        <div id="d-lastName"><TextField label={tx("d_last")} value={f.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" />{err("lastName")}</div>
        <div id="d-dateOfBirth">
          <p className="mb-2 text-[13px] font-medium">{tx("d_dob")}</p>
          <DobField value={f.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} t={tx} today={todayLocal()} />
          <p className="mt-2 text-xs text-muted-foreground">{tx("d_dob_help")}</p>
          {err("dateOfBirth")}
        </div>
      </div>

      <SectionTitle>{tx("d_contact")}</SectionTitle>
      <div className="flex flex-col gap-4">
        <div id="d-email"><TextField label={tx("d_email")} type="email" inputMode="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} />{err("email")}</div>
        <div id="d-phone">
          <p className="mb-2 whitespace-nowrap text-[13px] font-medium">{tx("d_mobile")}</p>
          <div className="grid grid-cols-[96px_1fr] items-end gap-2 [&_label:empty]:hidden">
            <Select label="" value={f.phoneCountry} onChange={(v) => set("phoneCountry", v)} options={opt(c, "phone_country", lang)} />
            <TextField label="" aria-label={tx("d_mobile")} type="tel" inputMode="tel" autoComplete="tel-national" value={f.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tx("d_mobile_help")}</p>
          {err("phone")}
        </div>
      </div>

      <SectionTitle>{tx("d_address")}</SectionTitle>
      <div className="flex flex-col gap-4">
        <Select label={tx("d_country")} value={f.country} onChange={(v) => { set("country", v); setManual(v !== "NL"); }} options={opt(c, "country", lang)} />
        <div className="grid grid-cols-[1fr_84px_90px] items-end gap-2">
          <div id="d-postcode"><TextField label={tx("d_postcode")} value={f.postcode} onChange={(e) => set("postcode", e.target.value)} autoComplete="postal-code" /></div>
          <div id="d-houseNumber"><TextField label={tx("d_house_number")} inputMode="numeric" value={f.houseNumber} onChange={(e) => set("houseNumber", e.target.value)} /></div>
          <TextField label={`${tx("d_suffix")} ${tx("optional")}`} value={f.suffix} onChange={(e) => set("suffix", e.target.value)} />
        </div>
        {(err("postcode") ?? err("houseNumber"))}
        {found && !manual && (
          <div className="flex items-center gap-3 rounded-[14px] border border-line px-4 py-3">
            <img src="/ui-icons/locatie.svg" alt="" className="size-4" />
            <span className="flex-1 text-[14px]"><span className="block font-semibold">{found.street} {f.houseNumber}{f.suffix ? ` ${f.suffix}` : ""}</span><span className="block text-muted-foreground">{f.postcode.toUpperCase()} {found.city}</span></span>
            <button type="button" onClick={() => setManual(true)} className="text-[13px] text-primary underline">{tx("d_not_right")}</button>
          </div>
        )}
        {manual && <>
          <div id="d-street"><TextField label={tx("d_street")} value={f.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" />{err("street")}</div>
          <div id="d-city"><TextField label={tx("d_city")} value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />{err("city")}</div>
        </>}
        {!manual && !found && (err("street"))}
      </div>

      <SectionTitle>{tx("d_two_things")}</SectionTitle>
      <div className="flex flex-col gap-4">
        {!existing && <Select label={`${tx("d_found_us")} ${tx("optional")}`} value={f.referral} onChange={(v) => set("referral", v)} options={opt(c, "referral_source", lang)} />}
        <TextArea label={`${tx("d_note")} ${tx("optional")}`} placeholder={tx("d_note_ph")} value={f.note} onChange={(e) => set("note", e.target.value)} />
      </div>

      <div className="mt-6"><AppointmentSummary c={c} s={s} treatmentId={treatmentId} locationId={locationId} practitionerId={practitionerId} tx={tx} lang={lang} onChange={again} /></div>

      <SectionTitle>{tx("d_consents")}</SectionTitle>
      <div className="flex flex-col gap-4">
        <div id="d-privacy">
          <Check checked={cons.privacy} onChange={(v) => setCons((x) => ({ ...x, privacy: v }))}>{privacy[0]}<a href="https://www.bodyclinic.nl/privacy" target="_blank" rel="noreferrer" className="text-primary underline">{tx("d_privacy_link")}</a>{privacy[1]}</Check>
          {err("privacy")}
        </div>
        <Check checked={cons.gp} onChange={(v) => setCons((x) => ({ ...x, gp: v }))}>{tx("d_c_gp")}</Check>
        {cons.gp && <div className="border-l-2 border-line pl-3"><TextField label={tx("d_gp_name")} value={cons.gpName} onChange={(e) => setCons((x) => ({ ...x, gpName: e.target.value }))} /></div>}
        <div>
          <Check checked={cons.lsp} onChange={(v) => setCons((x) => ({ ...x, lsp: v }))}>{tx("d_c_lsp")}</Check>
          <p className="mt-2 text-xs leading-[1.5] text-muted-foreground">{tx("d_c_lsp_help")}</p>
        </div>
        <Check checked={cons.marketing} onChange={(v) => setCons((x) => ({ ...x, marketing: v }))}>{tx("d_c_marketing", { merk: c.tenant.name })}</Check>
      </div>
    </Shell>
  );
}

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** "Je afspraak staat gepland" with calendar file and the start of the medical questionnaire. */
function ConfirmedStep({ c, s, treatmentId, locationId, practitionerId, manageToken, meetLink, tx, lang }: { c: Full; s: Search; treatmentId: string; locationId: string; practitionerId: string; manageToken: string; meetLink: string | null; tx: Tx; lang: string }) {
  const navigate = useNavigate();
  const t = c.treatments.find((x) => x.id === treatmentId);
  const l = c.locations.find((x) => x.id === locationId);
  const p = c.practitioners.find((x) => x.id === practitionerId);
  const hasQ = !!t?.post_questionnaire_key;
  const [left, setLeft] = useState(5);
  const start = () => void navigate({ to: "/vragenlijst/$token", params: { token: manageToken }, search: { merk: s.merk, lang: s.lang } });
  useEffect(() => {
    if (!hasQ) return;
    if (left <= 0) { start(); return; }
    const id = window.setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  });
  const tName = t ? ((lang === "en" && t.name_en) || t.name_nl) : "";
  const ics = () => {
    const [h, m] = (s.tijd ?? "00:00").split(":").map(Number) as [number, number];
    const startD = new Date(`${s.d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
    const end = new Date(startD.getTime() + (t?.duration_min ?? 30) * 60_000);
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Body Clinic//Booking//NL", "BEGIN:VEVENT", `UID:${manageToken}`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(startD)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${tName} · ${c.tenant.name}`, `LOCATION:${l?.kind === "online" ? tx("d_online_meet") : `${l?.name ?? ""}, ${l?.address ?? ""}`}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "afspraak.ics";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <Shell lang={lang} progress={1} onClose={() => navigate({ to: "/boeken", search: { merk: s.merk, lang: s.lang } })} footer={hasQ ? <p className="text-center text-[13px] text-muted-foreground">{tx("c_later")}</p> : null}>
      <span className="mb-6 flex size-[52px] items-center justify-center rounded-full bg-teal-light"><img src="/ui-icons/vinkje.svg" alt="" className="size-5" /></span>
      <Title>{tx("c_title")}</Title>
      <div className="rounded-[18px] bg-sand p-5">
        <div className="flex items-center gap-4">
          <Avatar src={p?.photo ?? null} size={64} />
          <p className="text-[16px] leading-[1.5]">{tx("c_expects", { naam: p ? `${p.first_name} ${p.last_name}` : c.tenant.name, dag: fmtLong(s.d ?? "", lang), tijd: s.tijd ?? "" })}</p>
        </div>
        <p className="mt-4 flex items-center gap-3 text-[14px]"><img src={l?.kind === "online" ? "/ui-icons/videogesprek.svg" : "/ui-icons/locatie.svg"} alt="" className="size-4" />{l?.kind === "online" ? tx("d_online_meet") : `${l?.name ?? ""}, ${l?.address ?? ""}`}</p>
        {l?.kind === "online" && meetLink && <p className="mt-2 flex items-center gap-3 text-[14px]"><img src="/ui-icons/videogesprek.svg" alt="" className="size-4 shrink-0" /><a href={meetLink} target="_blank" rel="noreferrer" className="truncate text-primary underline">{tx("m_join")}</a></p>}
        <p className="mt-2 flex items-center gap-3 text-[14px]"><img src="/ui-icons/klok.svg" alt="" className="size-4" />{tName}, {tx("c_minutes", { min: t?.duration_min ?? 0 })}</p>
        <button type="button" onClick={ics} className="mt-4 text-[14px] underline">{tx("c_add_calendar")}</button>
      </div>
      {hasQ && (
        <div className="mt-5 rounded-[18px] bg-teal-light p-5">
          <p className="text-[17px] font-semibold">{tx("c_one_step")}</p>
          <p className="mt-2 text-[14px] leading-[1.6]">{tx("c_one_step_body", { voornaam: p?.first_name ?? "", min: t?.questionnaire_minutes ?? 8 })}</p>
          <PillButton size="lg" className="mt-5 w-full" onClick={start}>{tx("c_start")}</PillButton>
          <p className="mt-3 text-center text-[12px]">{tx("c_auto", { n: left })}</p>
        </div>
      )}
    </Shell>
  );
}
