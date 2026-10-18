import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import type { Dossier } from "@/data/patients";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Appt = Dossier["appointments"][number];
type Note = { id: string; subjective: string; objective: string; evaluation: string; plan: string; checklist: Record<string, boolean>; updated_at: string; status: string };
const SOEP = [["subjective", "Subjectief"], ["objective", "Objectief"], ["evaluation", "Evaluatie"], ["plan", "Plan"]] as const;
const hm = (s: string | Date) => new Date(s).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });

export const consultNoteQuery = (apptId: string) => ({
  queryKey: ["consult-note", apptId],
  queryFn: async () => (await supabase.from("consult_notes").select("id, subjective, objective, evaluation, plan, checklist, updated_at, status").eq("appointment_id", apptId).maybeSingle()).data as Note | null,
});

/** Starts consult mode by creating the draft note; the open draft is what keeps consult mode on. */
export function useStartConsult(patientId: string, appt: Appt | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => { const r = await supabase.from("consult_notes").insert({ patient_id: patientId, appointment_id: appt!.id }); if (r.error) throw r.error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["consult-note", appt!.id] }),
    onError: () => toast.error("Starten is niet gelukt"),
  });
}

/** Sticky consult bar + draggable floating notes. Shown while a draft note exists for the appointment. */
export function ConsultMode({ patient, appt }: { patient: { id: string; first_name: string; last_name: string }; appt: Appt }) {
  const qc = useQueryClient();
  const { data: note } = useQuery(consultNoteQuery(appt.id));
  const { data: steps = [] } = useQuery({ queryKey: ["consult-steps"], queryFn: async () => (await supabase.from("option_lists").select("value, label_nl").eq("list_key", "consult_steps").order("sort")).data ?? [] });
  const [local, setLocal] = useState<Partial<Note>>({});
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [tab, setTab] = useState<"notes" | "steps">("notes");
  const [min, setMin] = useState(false);
  const [finish, setFinish] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [now, setNow] = useState(Date.now());
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);
  useEffect(() => { if (note?.updated_at) setSavedAt(hm(note.updated_at)); }, [note?.id]);

  // Autosave on every keystroke (debounced) so nothing is lost when switching tabs or pages.
  const patch = (p: Partial<Note>) => {
    const next = { ...local, ...p };
    setLocal(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!note) return;
      const r = await supabase.from("consult_notes").update(next).eq("id", note.id);
      if (r.error) toast.error("Opslaan is niet gelukt"); else setSavedAt(hm(new Date()));
    }, 400);
  };
  if (!note || note.status !== "draft") return null;
  const v = { ...note, ...local } as Note;
  const start = new Date(appt.starts_at).getTime(), end = new Date(appt.ends_at).getTime();
  const left = Math.max(0, Math.round((end - now) / 60_000));
  const pct = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const online = appt.location?.kind === "online";

  const onDown = (e: React.PointerEvent) => { drag.current = { sx: e.clientX, sy: e.clientY, ox: pos.x, oy: pos.y }; (e.target as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { const d = drag.current; if (d) setPos({ x: d.ox + e.clientX - d.sx, y: d.oy + e.clientY - d.sy }); };

  return (
    <>
      <div className="sticky top-0 z-30 flex flex-wrap items-center gap-4 rounded-[18px] bg-primary px-5 py-3.5 text-primary-foreground">
        <span className="flex items-center gap-2 whitespace-nowrap text-[14px] font-semibold"><span className="size-2 rounded-full bg-teal-light" />Consult bezig · {patient.first_name} {patient.last_name}</span>
        <span className="whitespace-nowrap text-[13px] opacity-80">{hm(appt.starts_at)} tot {hm(appt.ends_at)}</span>
        <span className="flex items-center gap-2 whitespace-nowrap rounded-full bg-primary-foreground/15 px-3 py-1 text-[13px]">Nog <b>{left} min</b><span className="h-1.5 w-24 rounded-full bg-primary-foreground/25"><span className="block h-full rounded-full bg-teal-light" style={{ width: `${pct}%` }} /></span></span>
        <span className="whitespace-nowrap text-[13px] opacity-80">Nu {hm(new Date(now))}</span>
        <div className="ml-auto flex gap-2">
          {online && appt.meet_link && <a href={appt.meet_link} target="_blank" rel="noreferrer"><PillButton variant="outline" className="bg-background">Meet</PillButton></a>}
          <Link to="/agenda/mijn-dag"><PillButton variant="outline" className="bg-background">Agenda</PillButton></Link>
        </div>
      </div>

      <div className="fixed right-6 top-6 z-40 flex w-[380px] flex-col rounded-[20px] bg-sand shadow-[0_8px_24px_rgba(57,51,46,0.16)] ring-1 ring-primary" style={{ transform: `translate(${pos.x}px, ${pos.y}px)`, maxHeight: "calc(100vh - 48px)" }}>
        <div className="flex cursor-move touch-none items-center gap-2 px-5 pt-4" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => (drag.current = null)}>
          <span className="text-[14px] font-semibold">Consultnotities</span>
          {savedAt && <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[12px] text-primary"><img src="/ui-icons/vinkje.svg" alt="" className="size-3" />opgeslagen {savedAt}</span>}
          <button type="button" aria-label={min ? "Openklappen" : "Inklappen"} onPointerDown={(e) => e.stopPropagation()} onClick={() => setMin(!min)} className={cn("flex size-7 items-center justify-center rounded-full bg-background", !savedAt && "ml-auto")}><img src={min ? "/ui-icons/plus.svg" : "/ui-icons/min.svg"} alt="" className="size-3.5" /></button>
        </div>
        {!min && (
          <>
            <p className="px-5 pt-1 text-[12px] text-muted-foreground">Alles wat je hier typt wordt direct bewaard, ook als je naar een ander tabblad, de agenda of een andere patiënt gaat. Het paneel blijft staan tot je het consult afrondt.</p>
            <div className="mx-5 mt-3 flex rounded-full bg-background p-1">{([["notes", "Notities"], ["steps", "Stappen"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={cn("flex-1 rounded-full py-1.5 text-[13px]", tab === k ? "bg-primary text-primary-foreground" : "")}>{l}</button>)}</div>
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tab === "notes" ? SOEP.map(([k, l]) => (
                <label key={k} className="mb-3 block"><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{l}</span>
                  <textarea value={v[k]} onChange={(e) => patch({ [k]: e.target.value })} rows={3} className="w-full resize-y rounded-[14px] bg-background p-3 text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
              )) : (
                <div className="rounded-[14px] bg-background p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stappen van dit consult</p>
                  {steps.map((s, i) => <div key={s.value} className="flex items-center gap-3 py-1.5"><Checkbox checked={!!v.checklist?.[s.value]} label={`${i + 1}. ${s.label_nl}`} onChange={(c) => patch({ checklist: { ...v.checklist, [s.value]: c } })} /><span className="text-[13px]">{i + 1}. {s.label_nl}</span></div>)}
                </div>
              )}
            </div>
            <div className="flex gap-2 px-5 pb-4 pt-2"><PillButton onClick={() => setFinish(true)}>Consult afronden</PillButton></div>
          </>
        )}
      </div>
      {finish && <FinishModal note={v} patient={patient} appt={appt} steps={steps} onClose={() => setFinish(false)} onDone={() => qc.invalidateQueries()} />}
    </>
  );
}

function FinishModal({ note, patient, appt, steps, onClose, onDone }: { note: Note; patient: { id: string; first_name: string; last_name: string }; appt: Appt; steps: Array<{ value: string; label_nl: string }>; onClose: () => void; onDone: () => void }) {
  const { data: plan } = useQuery({ queryKey: ["plan-filled", patient.id], queryFn: async () => { const f = (await supabase.from("treatment_plans").select("fields").eq("patient_id", patient.id).maybeSingle()).data?.fields as Record<string, string> | undefined; return !!f && Object.values(f).some(Boolean); } });
  const filled = SOEP.filter(([k]) => note[k].trim()).length;
  const done = steps.filter((s) => note.checklist?.[s.value]).length;
  const fin = useMutation({
    mutationFn: async () => { const r = await supabase.from("consult_notes").update({ status: "final", finished_at: new Date().toISOString() }).eq("id", note.id); if (r.error) throw r.error; },
    onSuccess: () => { toast.success("Consult afgerond"); onDone(); onClose(); },
    onError: () => toast.error("Afronden is niet gelukt"),
  });
  const row = (ok: boolean, title: string, sub: string, link?: React.ReactNode) => (
    <div className="flex items-center gap-3 rounded-[14px] p-3.5 ring-1 ring-mist">
      <span className={cn("flex size-7 items-center justify-center rounded-full", ok ? "bg-teal-light" : "bg-warning-bg")}><img src={ok ? "/ui-icons/vinkje.svg" : "/ui-icons/waarschuwing.svg"} alt="" className="size-3.5" /></span>
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
