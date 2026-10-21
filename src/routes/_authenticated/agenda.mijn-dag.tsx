import { useQuery, useQueries } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { PillButton } from "@/components/PillButton";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { agendaApptsQuery, agendaRefQuery } from "@/data/agenda";
import { externalBusyQuery } from "@/data/external-busy";
import { ExternalBusyBlock } from "@/features/agenda/ExternalBusyBlocks";
import { FollowUps } from "@/features/dossier/FollowUps";
import { daySegments, hourRange, nowAndNext } from "@/domain/agenda";
import type { SlotBlock, SlotException } from "@/domain/slots";
import { fmtTime } from "@/domain/slots";
import { appointmentAnswersQuery, PatientCard, signalsOf } from "@/features/agenda/PatientCard";
import { AgendaToolbar } from "@/features/agenda/AgendaToolbar";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AppointmentStatus } from "@/features/agenda/AppointmentActions";
import {orgQuery} from "@/data/organisation";

const TZ = "Europe/Amsterdam";
const local = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return { date: `${p["year"]}-${p["month"]}-${p["day"]}`, minute: Number(p["hour"]) * 60 + Number(p["minute"]) };
};
const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const HOUR = 114;

export const Route = createFileRoute("/_authenticated/agenda/mijn-dag")({
  validateSearch: z.object({ datum: z.string().optional(), behandelaar: z.string().optional(), afspraak: z.string().optional() }),
  head: () => ({ meta: [{ title: "Mijn dag · Beheer · The Body Clinic" }, { name: "description", content: "Dagagenda en patiëntafspraken per behandelaar van The Body Clinic." }, { property: "og:title", content: "Mijn dag · The Body Clinic" }, { property: "og:description", content: "Dagagenda en patiëntafspraken per behandelaar van The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

/** Now in clinic time, refreshed every 30 s for the now-line and the timers. */
function useNow() {
  const [n, setN] = useState(() => local(new Date().toISOString()));
  useEffect(() => { const t = window.setInterval(() => setN(local(new Date().toISOString())), 30_000); return () => window.clearInterval(t); }, []);
  return n;
}

function Page() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/agenda/mijn-dag" });
  const now = useNow();
  const date = s.datum ?? now.date;
  const { data: ref } = useQuery(agendaRefQuery);
  const {data:org}=useQuery(orgQuery);
  const { data: external } = useQuery(externalBusyQuery);
  const { data: me } = useQuery({ queryKey: ["me-practitioner"], queryFn: async () => {
    const { data: u } = await supabase.auth.getUser();
    return (await supabase.from("practitioners").select("id").eq("user_id", u.user?.id ?? "").maybeSingle()).data?.id ?? null;
  } });
  const { data: raw } = useQuery(agendaApptsQuery(`${shift(date, -1)}T00:00:00Z`, `${shift(date, 2)}T00:00:00Z`));
  const go = (patch: Partial<typeof s>) => void navigate({ search: (p) => ({ ...p, ...patch }) });
  const pid = s.behandelaar ?? me ?? ref?.practitioners[0]?.id ?? "";
  const prac = ref?.practitioners.find((p) => p.id === pid);

  const view = useMemo(() => {
    if (!ref || !raw) return null;
    const locs = new Map(ref.locations.map((l) => [l.id, l]));
    const appts = raw.map((a) => ({ ...a, s: local(a.starts_at), e: local(a.ends_at) })).filter((a) => !["cancelled", "no_show"].includes(a.status) && a.practitioner_id === pid && a.s.date === date)
      .map((a) => ({ ...a, start: a.s.minute, end: a.e.minute, online: locs.get(a.location_id)?.kind === "online", locName: locs.get(a.location_id)?.name ?? "" })).sort((a, b) => a.start - b.start);
    const breaks = daySegments(pid, date, ref.blocks as SlotBlock[], ref.exceptions as SlotException[]).filter((g) => g.kind === "break");
    const range = hourRange([...appts.flatMap((a) => [a.start, a.end]), ...breaks.flatMap((b) => [b.start, b.end])]);
    return { appts, breaks, range: [range[0], Math.max(range[1], 18)] as [number, number] };
  }, [ref, raw, pid, date]);

  const answers = useQueries({ queries: (view?.appts ?? []).map((a) => appointmentAnswersQuery(a.id)) });
  const sigCount = (i: number) => signalsOf(answers[i]?.data ?? []).length;
  const done = (i: number) => (answers[i]?.data ?? []).some((x) => x.status === "completed");
  const tName = (id: string) => ref?.treatments.find((t) => t.id === id)?.name_nl ?? "";
  const isToday = date === now.date;
  const nn = view && isToday ? nowAndNext(view.appts, now.minute) : null;
  const selected = view?.appts.find((a) => a.id === s.afspraak) ?? nn?.next ?? view?.appts[0];
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const summary = view ? (() => {
    const a = view.appts; if (!a.length) return "Geen afspraken";
    const on = a.filter((x) => x.online).length;
    const clinics = [...new Set(a.filter((x) => !x.online).map((x) => x.locName))];
    return [`${a.length} afspraken`, `${fmtTime(a[0]!.start)} tot ${fmtTime(Math.max(...a.map((x) => x.end)))}`, [on ? `${on} online` : "", ...clinics.map((c) => `${a.filter((x) => x.locName === c).length} in ${c}`)].filter(Boolean).join(", ")].join(" · ");
  })() : "";

  return (
    <div className="flex flex-col gap-6">
      <div className="min-h-11"><PageHeader title="Mijn dag" actions={prac && <span className="whitespace-nowrap rounded-full bg-teal-light px-3 py-1 text-[12px] text-primary">{prac.first_name} {prac.last_name}</span>} /></div>
      <AgendaToolbar value="mijn"
        onChange={(v) => v !== "mijn" && void navigate({ to: "/agenda", search: { datum: s.datum, weergave: v === "week" ? "week" : undefined, behandelaar: pid } })}
        filters={<Select label="Behandelaar" className="w-[230px] [&>label]:sr-only" value={pid} onChange={(v) => go({ behandelaar: v, afspraak: undefined })} options={(ref?.practitioners ?? []).map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))} />}
        dateControls={<>
          <button type="button" aria-label="Vorige dag" onClick={() => go({ datum: shift(date, -1), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <span className="whitespace-nowrap text-[15px] font-semibold">{label.charAt(0).toUpperCase() + label.slice(1)}</span>
          <button type="button" aria-label="Volgende dag" onClick={() => go({ datum: shift(date, 1), afspraak: undefined })} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
          {!isToday && <PillButton variant="ghost" size="sm" onClick={() => go({ datum: undefined, afspraak: undefined })}>Vandaag</PillButton>}
        </>} />
      <FollowUps />

      {nn && (nn.current || nn.next) && (
        <div className="grid grid-cols-2 gap-4">
          {nn.current ? (
            <div className="flex items-center justify-between gap-4 rounded-[18px] bg-sand px-5 py-4">
              <div className="min-w-0"><p className="text-[12px] text-muted-foreground">Nu bezig</p><p className="truncate text-[16px] font-semibold">{nn.current.patient?.first_name} {nn.current.patient?.last_name} · {tName(nn.current.treatment_id).toLowerCase()}</p>
                <p className="text-[13px] text-muted-foreground">{fmtTime(nn.current.start)} tot {fmtTime(nn.current.end)} · nog <b className="text-foreground">{nn.minutesLeft} minuten</b></p></div>
              {nn.current.online && nn.current.meet_link && <a href={nn.current.meet_link} target="_blank" rel="noreferrer"><PillButton variant="outline"><img src="/ui-icons/videogesprek.svg" alt="" className="size-4" />Terug naar Meet</PillButton></a>}
            </div>
          ) : <span />}
          {nn.next && (
            <div className="flex items-center justify-between gap-4 rounded-[18px] bg-teal-light px-5 py-4 ring-1 ring-primary">
              <div className="min-w-0"><p className="text-[12px] text-primary">Volgende</p><p className="truncate text-[16px] font-semibold">{nn.next.patient?.first_name} {nn.next.patient?.last_name} · {tName(nn.next.treatment_id).toLowerCase()}</p>
                <p className="text-[13px] text-muted-foreground">{fmtTime(nn.next.start)} · over <b className="text-foreground">{nn.minutesUntil} minuten</b>{(() => { const i = view!.appts.indexOf(nn.next); const n = sigCount(i); return n ? ` · ${n} ${n === 1 ? "signaal" : "signalen"}` : ""; })()}</p></div>
              {nn.next.online && (nn.next.meet_link ? <a href={nn.next.meet_link} target="_blank" rel="noreferrer"><PillButton><img src="/ui-icons/videogesprek.svg" alt="" className="size-4 invert" />Start Google Meet</PillButton></a>
                : <PillButton disabled><img src="/ui-icons/videogesprek.svg" alt="" className="size-4 invert" />Start Google Meet</PillButton>)}
            </div>
          )}
        </div>
      )}

      {!view ? <p className="text-[14px] text-muted-foreground">Laden…</p> : (
        <div className="grid grid-cols-[1fr_360px] items-start gap-6">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between text-[13px] text-muted-foreground"><span>{summary}</span>
              <span className="flex gap-4"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-primary" />Online</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-warning" />Kliniek</span></span></div>
            <div className="relative rounded-[18px] ring-1 ring-mist" style={{ height: (view.range[1] - view.range[0]) * HOUR + 28 }}>
              {Array.from({ length: view.range[1] - view.range[0] + 1 }, (_, i) => (
                <div key={i} className="absolute inset-x-0 flex gap-3 px-3" style={{ top: 14 + i * HOUR }}>
                  <span className="w-10 -translate-y-1/2 text-[12px] text-muted-foreground">{fmtTime((view.range[0] + i) * 60)}</span><span className="flex-1 border-t border-mist" />
                </div>
              ))}
              {view.breaks.map((b, i) => (
                <div key={i} className="hatch absolute left-[60px] right-3 flex items-center rounded-[12px] px-4 text-[13px] text-muted-foreground ring-1 ring-mist" style={{ top: 14 + ((b.start - view.range[0] * 60) / 60) * HOUR, height: ((b.end - b.start) / 60) * HOUR }}>Pauze · {fmtTime(b.start)} tot {fmtTime(b.end)}</div>
              ))}
              {view.appts.map((a, i) => {
                const on = selected?.id === a.id;
                const past = isToday && a.end <= now.minute;
                const n = sigCount(i);
                return (
                  <button key={a.id} type="button" onClick={() => go({ afspraak: a.id })}
                    className={cn("absolute left-[60px] right-3 flex items-center gap-3 rounded-[12px] px-3 text-left ring-1", on ? "bg-teal-light ring-primary" : nn?.current?.id === a.id ? "bg-sand ring-primary" : "bg-background ring-mist", past && "opacity-60")}
                    style={{ top: 14 + ((a.start - view.range[0] * 60) / 60) * HOUR + 2, height: Math.max(48, ((a.end - a.start) / 60) * HOUR - 6) }}>
                    <span className={cn("h-[70%] w-[3px] rounded-full", a.online ? "bg-primary" : "bg-warning")} />
                    <span className="min-w-0 flex-1">
                      <span className="block whitespace-nowrap text-[14px] font-semibold">{fmtTime(a.start)} · {a.patient?.first_name} {a.patient?.last_name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">{tName(a.treatment_id)} · {a.patient?.patient_number} · {a.new_patient ? "nieuw" : "vervolg"}{a.online ? " · Online" : ""}{a.room_id?` · ${org?.rooms.find(r=>r.id===a.room_id)?.name??""}`:""}</span>
                    </span>
                    {n > 0 && <span className="whitespace-nowrap rounded-full bg-signal px-2.5 py-0.5 text-[11px] ring-1 ring-signal-border">{n} {n === 1 ? "signaal" : "signalen"}</span>}
                    <AppointmentStatus status={a.status}/>
                    {done(i) ? <img src="/ui-icons/vinkje.svg" alt="Vragenlijst ingevuld" className="size-4" /> : <img src="/ui-icons/waarschuwing.svg" alt="Vragenlijst nog niet ingevuld" className="size-4" />}
                    {a.online
                      ? <span className="flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-[12px] text-primary-foreground"><img src="/ui-icons/videogesprek.svg" alt="" className="size-3.5 invert" />Meet</span>
                      : <span className="flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] ring-1 ring-mist"><img src="/ui-icons/locatie.svg" alt="" className="size-3.5" />{a.locName}</span>}
                  </button>
                );
              })}
              {external?.visible && external.periods.filter((b) => b.practitioner_id === pid && local(b.starts_at).date === date).map((b) => {
                const start = local(b.starts_at).minute, end = local(b.ends_at).minute;
                return <ExternalBusyBlock key={b.id} start={start} end={end} top={14 + (start - view.range[0] * 60) / 60 * HOUR} height={(end - start) / 60 * HOUR} className="left-[60px] right-3" />;
              })}
              {isToday && now.minute >= view.range[0] * 60 && now.minute <= view.range[1] * 60 && (
                <div className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: 14 + ((now.minute - view.range[0] * 60) / 60) * HOUR }}>
                  <span className="w-[52px] pl-3 text-[11px] font-semibold text-warning">{fmtTime(now.minute)}</span><span className="size-2 rounded-full bg-warning" /><span className="h-px flex-1 bg-warning" />
                </div>
              )}
            </div>
          </div>
          {selected && ref && <PatientCard framed a={selected} treatment={tName(selected.treatment_id)} online={selected.online} />}
        </div>
      )}
      <p className="text-[13px] leading-[1.6] text-muted-foreground">Google Meet werkt met één gekoppeld account van The Body Clinic. Per afspraak maakt het systeem via dat account een agenda-afspraak met een eigen Meet-link en nodigt jou uit; zo staat de link in jouw Google Agenda, hier in Mijn dag, en in de mails van de patiënt. Klik je op een afspraak, dan opent rechts de patiëntkaart, dezelfde als in de agenda en de patiëntenlijst; het dossier open je met één knop.</p>
    </div>
  );
}
