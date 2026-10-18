import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { Logo } from "@/components/Logo";
import { PatientFrame } from "@/components/PatientFrame";
import { PillButton } from "@/components/PillButton";
import { cancelAppointment, getManagedAppointment, getRescheduleSlots, rescheduleAppointment, setCancelReason } from "@/data/manage.functions";
import { fmtTime } from "@/domain/slots";
import { cn } from "@/lib/utils";

const mq = (token: string, merk: string | undefined) => queryOptions({ queryKey: ["manage", token, merk ?? ""], queryFn: () => getManagedAppointment({ data: { token, merk } }) });

export const Route = createFileRoute("/afspraak/$token")({
  validateSearch: z.object({ merk: z.string().optional(), lang: z.enum(["nl", "en"]).optional(), stap: z.enum(["verzetten", "geannuleerd"]).optional() }),
  loaderDeps: ({ search }) => ({ merk: search.merk }),
  loader: ({ context, params, deps }) => context.queryClient.ensureQueryData(mq(params.token, deps.merk)),
  head: () => ({
    meta: [
      { title: "Je afspraak · The Body Clinic" },
      { name: "description", content: "Bekijk, verzet of annuleer je afspraak bij The Body Clinic." },
      { property: "og:title", content: "Je afspraak · The Body Clinic" },
      { property: "og:description", content: "Bekijk, verzet of annuleer je afspraak." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Manage,
});

const Chevron = () => <img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4 shrink-0" />;

function Shell({ children, footer, onBack }: { children: React.ReactNode; footer?: React.ReactNode; onBack?: () => void }) {
  return (
    <PatientFrame>
        <header className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-2">
          {onBack ? <button type="button" onClick={onBack} aria-label="Terug" className="flex justify-center"><img src="/ui-icons/pijl-links.svg" alt="" className="size-5" /></button> : <span />}
          <span className="flex justify-center"><Logo small /></span>
          <span />
        </header>
        <div className="h-[3px] bg-primary" />
        <main className="flex flex-1 flex-col px-5 pb-6 pt-8">{children}</main>
        {footer && <footer className="px-5 pb-6">{footer}</footer>}
      </div>
    </div>
  );
}

function Manage() {
  const { token } = Route.useParams();
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/afspraak/$token" });
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(mq(token, s.merk));
  const lang = s.lang ?? "nl";
  const tx = (key: string, vars: Record<string, string | number> = {}) => {
    const r = data.ui.find((u) => u.list_key === "booking_ui" && u.value === key);
    return ((lang === "en" && r?.label_en) || r?.label_nl || "").replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
  };
  const cancel = useServerFn(cancelAppointment);
  const reason = useServerFn(setCancelReason);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const go = (stap?: "verzetten" | "geannuleerd") => navigate({ search: (p) => ({ ...p, stap }) });

  if (!data.found) return <Shell><p className="text-[15px]">{tx("m_not_found")}</p></Shell>;
  const loc = lang === "en" ? "en-GB" : "nl-NL";
  const when = (iso: string, withAt = false) => {
    const d = new Date(iso);
    const day = d.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: data.timeZone });
    const t = d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: data.timeZone });
    return withAt ? `${day} ${lang === "en" ? "at" : "om"} ${t}` : `${day} ${t}`;
  };
  const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
  const tName = (lang === "en" && data.treatment.en) || data.treatment.nl;
  const refresh = () => qc.invalidateQueries({ queryKey: ["manage", token] });

  if (s.stap === "geannuleerd" || data.status === "cancelled") {
    const current = picked ?? data.cancelReason;
    const reasons = data.ui.filter((u) => u.list_key === "cancel_reason");
    return (
      <Shell footer={<PillButton size="lg" className="w-full" onClick={() => void navigate({ to: "/boeken", search: { merk: s.merk, lang: s.lang } })}>{tx("x_new")}</PillButton>}>
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">{tx("x_title")}</h1>
        <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{tx("x_body", { wanneer: cap(when(data.startsAt, true)) })}</p>
        <p className="mb-3 mt-8 text-[14px]">{tx("x_why")} <span className="text-muted-foreground">{tx("x_optional")}</span></p>
        <div className="flex flex-col gap-2" role="radiogroup">
          {reasons.map((r) => {
            const on = current === r.value;
            return (
              <button key={r.value} type="button" role="radio" aria-checked={on} onClick={() => { setPicked(r.value); void reason({ data: { token, merk: s.merk, reason: r.value } }); }}
                className={cn("flex min-h-[48px] items-center gap-3 rounded-[14px] px-4 text-left text-[15px]", on ? "bg-teal-light ring-1 ring-primary" : "bg-sand")}>
                <span className={cn("flex size-[18px] items-center justify-center rounded-full border", on ? "border-primary" : "border-muted-foreground")}>{on && <span className="size-2.5 rounded-full bg-primary" />}</span>
                {(lang === "en" && r.label_en) || r.label_nl}
              </button>
            );
          })}
        </div>
      </Shell>
    );
  }

  if (s.stap === "verzetten" && data.canChange) return <Reschedule data={data} token={token} merk={s.merk} lang={lang} tx={tx} when={when} cap={cap} onBack={() => go()} onDone={async () => { await refresh(); go(); }} />;

  const ics = () => {
    const f = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//The Body Clinic//Booking//NL", "BEGIN:VEVENT", `UID:${token}`, `DTSTAMP:${f(new Date().toISOString())}`, `DTSTART:${f(data.startsAt)}`, `DTEND:${f(data.endsAt)}`, `SUMMARY:${tName}`, `LOCATION:${data.location.online ? "Google Meet" : `${data.location.name}, ${data.location.address}`}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = "afspraak.ics";
    a.click();
  };
  const doCancel = async () => {
    setBusy(true);
    const r = await cancel({ data: { token, merk: s.merk } });
    setBusy(false);
    if (r.ok) { await refresh(); go("geannuleerd"); }
  };
  const Row = ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button type="button" onClick={onClick} disabled={busy} className="flex min-h-[46px] items-center justify-between rounded-[14px] bg-sand px-4 text-left text-[15px]">{label}<Chevron /></button>
  );
  const time = new Date(data.startsAt).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: data.timeZone });
  const day = new Date(data.startsAt).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: data.timeZone });

  return (
    <Shell>
      <p className="mb-2 text-[13px] text-primary">{tx("m_label")}</p>
      <h1 className="mb-6 text-[28px] font-semibold leading-[1.2] tracking-tight">{tName}</h1>
      <div className="rounded-[18px] bg-teal-light p-5">
        <p className="text-[17px] font-semibold">{cap(day)}, {time}</p>
        <p className="mt-2 text-[14px]">{data.location.online ? tx("m_online_line", { min: data.treatment.minutes }) : tx("m_clinic_line", { locatie: data.location.name, min: data.treatment.minutes })}</p>
        <p className="text-[14px]">{tx("m_with", { naam: data.practitioner.name })}</p>
        {data.location.online && data.meetLink && <a href={data.meetLink} target="_blank" rel="noreferrer" className="mt-4 flex h-11 items-center justify-center rounded-full bg-primary text-[15px] text-primary-foreground">{tx("m_join")}</a>}
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <Row label={tx("c_add_calendar")} onClick={ics} />
        {data.treatment.hasQuestionnaire && <Row label={tx("m_questionnaire")} onClick={() => void navigate({ to: "/vragenlijst/$token", params: { token }, search: { merk: s.merk, lang: s.lang } })} />}
        {data.canChange && <Row label={tx("m_reschedule")} onClick={() => go("verzetten")} />}
        {data.canChange && <Row label={tx("m_cancel")} onClick={() => void doCancel()} />}
      </div>
      <p className="mt-6 text-[13px] leading-[1.6] text-muted-foreground">{tx("m_rule", { uur: data.hours, telefoon: data.phone ?? "" })}</p>
    </Shell>
  );
}

type Found = Extract<Awaited<ReturnType<typeof getManagedAppointment>>, { found: true }>;

function Reschedule({ data, token, merk, lang, tx, when, cap, onBack, onDone }: {
  data: Found; token: string; merk: string | undefined; lang: string; tx: (k: string, v?: Record<string, string | number>) => string;
  when: (iso: string, at?: boolean) => string; cap: (x: string) => string; onBack: () => void; onDone: () => Promise<void>;
}) {
  const slotsFn = useServerFn(getRescheduleSlots);
  const move = useServerFn(rescheduleAppointment);
  const navigate = useNavigate();
  const { data: slots = [], isLoading } = useQuery({ queryKey: ["reschedule", token], queryFn: () => slotsFn({ data: { token, merk } }) });
  const [pick, setPick] = useState<{ date: string; start: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const loc = lang === "en" ? "en-GB" : "nl-NL";
  const short = (date: string, start: number) => {
    const d = new Date(`${date}T12:00:00Z`);
    const wd = d.toLocaleDateString(loc, { weekday: "short", timeZone: "UTC" }).replace(".", "");
    const m = d.toLocaleDateString(loc, { month: "short", timeZone: "UTC" }).replace(".", "");
    return `${cap(wd)} ${d.getUTCDate()} ${m} ${fmtTime(start)}`;
  };
  const long = (date: string, start: number) => `${new Date(`${date}T12:00:00Z`).toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} ${fmtTime(start)}`;
  const confirm = async () => {
    if (!pick) return;
    setBusy(true);
    const r = await move({ data: { token, merk, date: pick.date, start: pick.start } });
    setBusy(false);
    if (r.ok) await onDone();
  };
  return (
    <Shell onBack={onBack} footer={pick ? <PillButton size="lg" className="w-full" disabled={busy} onClick={() => void confirm()}>{tx("r_confirm", { wanneer: long(pick.date, pick.start) })}</PillButton> : null}>
      <p className="mb-2 text-[13px] text-primary">{tx("m_reschedule")}</p>
      <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight">{tx("r_title")}</h1>
      <p className="mt-3 text-[15px] leading-[1.6] text-muted-foreground">{tx("r_body")}</p>
      <p className="mb-3 mt-6 text-[14px]">{tx("r_next", { naam: data.practitioner.firstName, waar: data.location.online ? tx("r_online") : data.location.name })}</p>
      {!isLoading && slots.length === 0 && <p className="text-[14px] text-muted-foreground">{tx("r_none")}</p>}
      <div className="flex flex-wrap gap-2">
        {slots.map((x) => {
          const on = pick?.date === x.date && pick.start === x.start;
          return <button key={`${x.date}-${x.start}`} type="button" onClick={() => setPick(x)} className={cn("h-11 whitespace-nowrap rounded-full px-4 text-[15px]", on ? "bg-teal-light ring-1 ring-primary" : "bg-sand")}>{short(x.date, x.start)}</button>;
        })}
      </div>
      <button type="button" className="mt-4 self-start text-[14px] text-primary underline" onClick={() => void navigate({ to: "/boeken", search: { merk, lang: lang as "nl" | "en", t: data.treatment.id } })}>{tx("r_other")}</button>
      <p className="mt-6 rounded-[14px] bg-sand p-4 text-[13px] leading-[1.6] text-muted-foreground">{tx("r_current", { wanneer: when(data.startsAt, false) })}</p>
    </Shell>
  );
}
