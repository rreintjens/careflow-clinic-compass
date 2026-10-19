import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { UiIcon } from "@/components/UiIcon";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Note = { id: string; subjective: string; objective: string; evaluation: string; plan: string; checklist: Record<string, boolean>; updated_at: string; status: string };
type Patient = { id: string; first_name: string; last_name: string; patient_number: string | null };
type ApptInfo = { id: string; starts_at: string; ends_at: string; meet_link: string | null; practitioner_id: string | null; location: { kind: string } | null };
export type ActiveConsult = Note & { patient: Patient; appointment: ApptInfo };
const SOEP = [["subjective", "Subjectief"], ["objective", "Objectief"], ["evaluation", "Evaluatie"], ["plan", "Plan"]] as const;
const hm = (s: string | Date) => new Date(s).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: undefined, timeZone: "Europe/Amsterdam" });
const hms = (s: string | Date) => new Date(s).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Europe/Amsterdam" });
const NOTE_COLS = "id, subjective, objective, evaluation, plan, checklist, updated_at, status";
const FINISH_EVENT = "tbc:finish-consult";

export const consultNoteQuery = (apptId: string) => ({
  queryKey: ["consult-note", apptId],
  queryFn: async () => (await supabase.from("consult_notes").select(NOTE_COLS).eq("appointment_id", apptId).maybeSingle()).data as Note | null,
});

/** The signed-in user's one active consult (a draft note on an appointment), wherever they are in the app. */
export const activeConsultQuery = {
  queryKey: ["active-consult"],
  queryFn: async (): Promise<ActiveConsult | null> => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;
    const { data } = await supabase.from("consult_notes")
      .select(`${NOTE_COLS}, patient:patients(id, first_name, last_name, patient_number), appointment:appointments(id, starts_at, ends_at, meet_link, practitioner_id, location:locations(kind))`)
      .eq("status", "draft").eq("created_by", u.user.id).not("appointment_id", "is", null).maybeSingle();
    return (data as unknown as ActiveConsult | null) ?? null;
  },
};

const refreshConsult = (qc: ReturnType<typeof useQueryClient>) => Promise.all([qc.invalidateQueries({ queryKey: ["active-consult"] }), qc.invalidateQueries({ queryKey: ["consult-note"] })]);

/** Start, resume, or (when another consult is open) ask to finish or park that one first. */
export function StartConsultButton({ patientId, apptId, note }: { patientId: string; apptId: string; note: Note | null | undefined }) {
  const qc = useQueryClient();
  const { data: active } = useQuery(activeConsultQuery);
  const [ask, setAsk] = useState(false);
  const go = useMutation({
    mutationFn: async (parkFirst: boolean) => {
      if (parkFirst && active) { const r = await supabase.from("consult_notes").update({ status: "parked" }).eq("id", active.id); if (r.error) throw r.error; }
      const r = note ? await supabase.from("consult_notes").update({ status: "draft" }).eq("id", note.id) : await supabase.from("consult_notes").insert({ patient_id: patientId, appointment_id: apptId });
      if (r.error) throw r.error;
    },
    onSuccess: async () => { setAsk(false); await refreshConsult(qc); },
    onError: () => toast.error("Starten is niet gelukt"),
  });
  if (note?.status === "draft" || note?.status === "final") return null;
  const other = active && active.appointment.id !== apptId ? active : null;
  const name = other ? `${other.patient.first_name} ${other.patient.last_name}` : "";
  return (
    <>
      <PillButton variant="outline" disabled={go.isPending} onClick={() => (other ? setAsk(true) : go.mutate(false))}>{note?.status === "parked" ? "Consult hervatten" : "Start consult"}</PillButton>
      {ask && other && (
        <Modal open onOpenChange={(o) => !o && setAsk(false)} title="Er loopt al een consult" description={`Met ${name}, ${hm(other.appointment.starts_at)} tot ${hm(other.appointment.ends_at)}`}
          footer={<><PillButton variant="outline" onClick={() => setAsk(false)}>Annuleren</PillButton><PillButton variant="outline" onClick={() => { setAsk(false); window.dispatchEvent(new Event(FINISH_EVENT)); }}>Eerst afronden</PillButton><PillButton disabled={go.isPending} onClick={() => go.mutate(true)}>Parkeren en starten</PillButton></>}>
          <p className="text-sm leading-[1.6]">Je kunt één consult tegelijk open hebben. Rond het consult met {name} eerst af, of parkeer het: de notities blijven bewaard en je hervat het later vanuit het dossier.</p>
        </Modal>
      )}
    </>
  );
}

type Prefs = { x: number; y: number; w: number; h: number; min: boolean; tab: "notes" | "steps" };
const PREFS_KEY = "tbc-consult-panel";
const DEFAULT_PREFS: Prefs = { x: 0, y: 0, w: 380, h: 0, min: false, tab: "notes" };

/** Consult mode for the whole staff area: sticky bar above every page and the floating notes panel, until "Consult afronden". */
export function ActiveConsultMode() {
  const qc = useQueryClient();
  const { data: c } = useQuery(activeConsultQuery);
  const { data: steps = [] } = useQuery({ queryKey: ["consult-steps"], queryFn: async () => (await supabase.from("option_lists").select("value, label_nl").eq("list_key", "consult_steps").order("sort")).data ?? [], enabled: !!c });
  const { data: next } = useQuery({
    queryKey: ["consult-next", c?.appointment.id], enabled: !!c?.appointment.practitioner_id,
    queryFn: async () => {
      const a = c!.appointment;
      const dayEnd = new Date(a.starts_at); dayEnd.setHours(23, 59, 59, 999);
      const { data } = await supabase.from("appointments").select("starts_at, patient:patients(first_name, last_name)").eq("practitioner_id", a.practitioner_id!).eq("status", "booked")
        .gte("starts_at", a.ends_at).lte("starts_at", dayEnd.toISOString()).neq("id", a.id).order("starts_at").limit(1).maybeSingle();
      return data as { starts_at: string; patient: { first_name: string; last_name: string } | null } | null;
    },
  });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [local, setLocal] = useState<Partial<Note>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [finish, setFinish] = useState(false);
  const [now, setNow] = useState(Date.now());
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => { try { const raw = localStorage.getItem(PREFS_KEY); if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }); } catch { /* defaults */ } }, []);
  const savePrefs = (p: Partial<Prefs>) => setPrefs((x) => { const n = { ...x, ...p }; localStorage.setItem(PREFS_KEY, JSON.stringify(n)); return n; });
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(t); }, []);
  useEffect(() => { setLocal({}); if (c?.updated_at) setSavedAt(hms(c.updated_at)); }, [c?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const open = () => setFinish(true); window.addEventListener(FINISH_EVENT, open); return () => window.removeEventListener(FINISH_EVENT, open); }, []);
  // Remember the size the doctor drags the panel to.
  useEffect(() => {
    const el = panel.current;
    if (!el || prefs.min) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); if (Math.abs(r.width - prefs.w) > 2 || (prefs.h && Math.abs(r.height - prefs.h) > 2)) savePrefs({ w: Math.round(r.width), h: Math.round(r.height) }); });
    ro.observe(el);
    return () => ro.disconnect();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave on every keystroke (debounced); the note lives in the database, so navigating or reloading keeps it.
  const patch = (p: Partial<Note>) => {
    const nextVal = { ...local, ...p };
    setLocal(nextVal);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!c) return;
      const r = await supabase.from("consult_notes").update(nextVal).eq("id", c.id);
      if (r.error) toast.error("Opslaan is niet gelukt"); else { setSavedAt(hms(new Date())); qc.setQueryData(["active-consult"], { ...c, ...nextVal }); }
    }, 300);
  };
  const park = useMutation({
    mutationFn: async () => { if (!c) return; const r = await supabase.from("consult_notes").update({ ...local, status: "parked" }).eq("id", c.id); if (r.error) throw r.error; },
    onSuccess: () => { toast.success("Consult geparkeerd; hervat het vanuit het dossier"); void refreshConsult(qc); },
    onError: () => toast.error("Parkeren is niet gelukt"),
  });
  if (!c) return null;
  const v = { ...c, ...local } as ActiveConsult;
  const a = c.appointment, p = c.patient;
  const name = `${p.first_name} ${p.last_name}`;
  const start = new Date(a.starts_at).getTime(), end = new Date(a.ends_at).getTime();
  const left = Math.max(0, Math.round((end - now) / 60_000));
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const online = a.location?.kind === "online";
  const recordMatch = pathname.match(/^\/patienten\/([^/]+)/);
  const otherRecord = !!recordMatch && recordMatch[1] !== p.id && recordMatch[1] !== p.patient_number;

  // Keep the panel on screen whatever the window size; stored offsets are relative to the top-right corner.
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth, vh = typeof window === "undefined" ? 900 : window.innerHeight;
  const top = Math.min(Math.max(8, 24 + prefs.y), vh - 80);
  const right = Math.min(Math.max(8, 24 - prefs.x), Math.max(8, vw - prefs.w - 8));
  const onDown = (e: React.PointerEvent) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: prefs.x, oy: prefs.y }; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (d) setPrefs((x) => ({ ...x, x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy })); };
  const onUp = () => { if (drag.current) { drag.current = null; savePrefs({}); } };

  return (
    <>
      <div className="sticky top-0 z-30 -mt-2 mb-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[18px] bg-primary px-5 py-3.5 text-primary-foreground" role="region" aria-label="Consult bezig">
        <span className="flex items-center gap-2 whitespace-nowrap text-[14px] font-semibold"><span className="size-2 rounded-full bg-teal-light" />Consult bezig · {name}</span>
        <span className="whitespace-nowrap text-[13px] opacity-80">{hm(a.starts_at)} tot {hm(a.ends_at)}</span>
        <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground/15 px-3 py-1 text-[13px]">Nog <b>{left} min</b><span className="h-1.5 w-24 rounded-full bg-primary-foreground/25"><span className="block h-full rounded-full bg-teal-light" style={{ width: `${pct}%` }} /></span></span>
        <span className="whitespace-nowrap text-[13px] opacity-80">Nu {hm(new Date(now))}</span>
        <span className="whitespace-nowrap text-[13px] opacity-80">{next ? `Volgende: ${hm(next.starts_at)} ${next.patient?.first_name ?? ""} ${next.patient?.last_name ?? ""}` : "Geen volgende afspraak vandaag"}</span>
        <div className="ml-auto flex gap-2">
          {online && a.meet_link && <a href={a.meet_link} target="_blank" rel="noreferrer"><PillButton size="sm" className="bg-background text-primary hover:bg-background"><UiIcon name="videogesprek" className="size-4" />Meet</PillButton></a>}
          <Link to="/patienten/$id" params={{ id: p.id }}><PillButton size="sm" variant="outline" className="border-primary-foreground/60 bg-transparent text-primary-foreground">Dossier</PillButton></Link>
          <Link to="/agenda/mijn-dag"><PillButton size="sm" variant="outline" className="border-primary-foreground/60 bg-transparent text-primary-foreground">Agenda</PillButton></Link>
        </div>
      </div>

      <div ref={panel} aria-label={`Consultnotities voor ${name}`} role="complementary"
        className={cn("fixed z-40 flex flex-col overflow-hidden rounded-[20px] bg-sand shadow-[0_8px_24px_rgba(57,51,46,0.16)] ring-1", otherRecord ? "ring-2 ring-warning" : "ring-primary", !prefs.min && "resize")}
        style={{ top, right, width: prefs.w, ...(prefs.min ? {} : { height: prefs.h ? `min(${prefs.h}px, calc(100vh - ${top + 16}px))` : `calc(100vh - ${top + 24}px)` }), minWidth: 300, minHeight: prefs.min ? undefined : 260, maxHeight: `calc(100vh - ${top + 16}px)` }}>
        <div className="flex cursor-move touch-none select-none items-center gap-2 px-5 pt-4" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp}>
          <span className="min-w-0"><span className="block text-[14px] font-semibold">Consultnotities</span><span className={cn("block truncate text-[12px]", otherRecord ? "text-warning" : "text-muted-foreground")}>{name} · {p.patient_number}</span></span>
          {savedAt && <span className="ml-auto flex shrink-0 items-center gap-1 whitespace-nowrap text-[12px] text-primary"><UiIcon name="vinkje" className="size-3" />opgeslagen {savedAt}</span>}
          <button type="button" aria-label={prefs.min ? "Openklappen" : "Inklappen"} onPointerDown={(e) => e.stopPropagation()} onClick={() => savePrefs({ min: !prefs.min })} className={cn("flex size-7 shrink-0 items-center justify-center rounded-full bg-background", !savedAt && "ml-auto")}><UiIcon name={prefs.min ? "plus" : "min"} className="size-3.5" /></button>
        </div>
        {otherRecord && <p role="alert" className="mx-5 mt-2 rounded-[12px] bg-warning-bg px-3 py-2 text-[12px] text-warning">Je bekijkt een ander dossier. Deze notities horen bij {name} ({p.patient_number}).</p>}
        {prefs.min ? <div className="pb-4" /> : (
          <>
            <p className="px-5 pt-1 text-[12px] text-muted-foreground">Alles wat je hier typt wordt direct bewaard, ook als je naar een ander tabblad, de agenda of een andere patiënt gaat. Het paneel blijft staan tot je het consult afrondt.</p>
            <div className="mx-5 mt-3 flex rounded-full bg-background p-1">
              {([["notes", "Notities"], ["steps", "Stappen"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => savePrefs({ tab: k })} className={cn("flex-1 rounded-full py-1.5 text-[13px]", prefs.tab === k ? "bg-primary text-primary-foreground" : "")}>{l}</button>)}
              <Link to="/patienten/$id" params={{ id: p.id }} className="flex-1 rounded-full py-1.5 text-center text-[13px]">Dossier</Link>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              {prefs.tab === "notes" ? SOEP.map(([k, l]) => (
                <label key={k} className="mb-3 block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
                  <textarea value={v[k]} onChange={(e) => patch({ [k]: e.target.value })} rows={3} className="w-full resize-y rounded-[14px] bg-background p-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
              )) : (
                <div className="rounded-[14px] bg-background p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stappen van dit consult</p>
                  {steps.map((s, i) => <div key={s.value} className="py-1.5"><Checkbox checked={!!v.checklist?.[s.value]} label={`${i + 1}. ${s.label_nl}`} onChange={(on) => patch({ checklist: { ...v.checklist, [s.value]: on } })} /></div>)}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-4 pt-2"><PillButton onClick={() => setFinish(true)}>Consult afronden</PillButton><PillButton variant="outline" disabled={park.isPending} onClick={() => park.mutate()}>Parkeren</PillButton></div>
          </>
        )}
      </div>
      {finish && <FinishModal note={v} patient={p} appt={a} steps={steps} onClose={() => setFinish(false)} onDone={() => { localStorage.removeItem(PREFS_KEY); void qc.invalidateQueries(); }} />}
    </>
  );
}

function FinishModal({ note, patient, appt, steps, onClose, onDone }: { note: Note; patient: Patient; appt: ApptInfo; steps: Array<{ value: string; label_nl: string }>; onClose: () => void; onDone: () => void }) {
  const { data: plan } = useQuery({ queryKey: ["plan-filled", patient.id], queryFn: async () => { const f = (await supabase.from("treatment_plans").select("fields").eq("patient_id", patient.id).maybeSingle()).data?.fields as Record<string, string> | undefined; return !!f && Object.values(f).some(Boolean); } });
  const filled = SOEP.filter(([k]) => note[k].trim()).length;
  const done = steps.filter((s) => note.checklist?.[s.value]).length;
  const fin = useMutation({
    mutationFn: async () => {
      const { subjective, objective, evaluation, plan: p, checklist } = note;
      const r = await supabase.from("consult_notes").update({ subjective, objective, evaluation, plan: p, checklist, status: "final", finished_at: new Date().toISOString() }).eq("id", note.id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Consult afgerond"); onDone(); onClose(); },
    onError: () => toast.error("Afronden is niet gelukt"),
  });
  const row = (ok: boolean, title: string, sub: string, link?: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-[14px] p-3.5 ring-1 ring-mist">
      <span className={cn("flex size-7 items-center justify-center rounded-full", ok ? "bg-teal-light text-primary" : "bg-warning-bg text-warning")}><UiIcon name={ok ? "vinkje" : "waarschuwing"} className="size-3.5" /></span>
      <div className="flex-1"><p className="text-[14px]">{title}</p><p className="text-[12px] text-muted-foreground">{sub}</p></div>{link}
    </div>
  );
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={`Consult afronden · ${patient.first_name} ${patient.last_name}`} description={`${hm(appt.starts_at)} tot ${hm(appt.ends_at)}`}
      footer={<div className="flex w-full items-center justify-between"><button type="button" onClick={onClose} className="text-[14px] text-warning underline">Nog niet afronden</button><div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={fin.isPending} onClick={() => fin.mutate()}>Afronden</PillButton></div></div>}>
      <div className="flex flex-col gap-2">
        {row(filled === 4, "Consultverslag", filled === 4 ? "Subjectief, objectief, evaluatie en plan ingevuld" : `${filled} van 4 velden ingevuld`)}
        {row(done === steps.length, "Stappen", `${done} van ${steps.length} afgevinkt`)}
        {row(!!plan, "Behandelplan en medicatie", plan ? "Ingevuld" : "Nog leeg. Zonder plan kan de apotheek niets klaarzetten.", !plan && <Link to="/patienten/$id/behandeling" params={{ id: patient.id }} onClick={onClose} className="text-[13px] text-primary underline">Nu maken</Link>)}
      </div>
      <p className="mt-4 text-[12px] text-muted-foreground">Afronden zet het verslag vast in het dossier en sluit het notitiepaneel. Het Meet-gesprek sluit je zelf.</p>
    </Modal>
  );
}
