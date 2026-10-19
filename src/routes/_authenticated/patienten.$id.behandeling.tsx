import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EditableFieldRow, TextArea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { dossierQuery } from "@/data/patients";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { StandaloneConsultModal } from "@/features/dossier/StandaloneConsultModal";

export const Route = createFileRoute("/_authenticated/patienten/$id/behandeling")({ head: () => ({ meta: [{ title: "Behandeling · Dossier · The Body Clinic" }, { name: "description", content: "Consultverslagen, behandelplan en afspraken in het patiëntendossier." }, { property: "og:title", content: "Behandeling · The Body Clinic" }, { property: "og:description", content: "Consultverslagen, behandelplan en afspraken in het patiëntendossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Treatment });

const TZ = "Europe/Amsterdam";
const SOEP = [["subjective", "Subjectief: wat de patiënt vertelt"], ["objective", "Objectief: metingen en bevindingen"], ["evaluation", "Evaluatie: beoordeling en indicatie"], ["plan", "Plan: behandeling, medicatie, afspraken"]] as const;
type SoepKey = (typeof SOEP)[number][0];
const when = (s: string) => new Date(s).toLocaleString("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(" om ", ", ");
const STATUS: Record<string, string> = { booked: "Bevestigd", cancelled: "Geannuleerd", no_show: "Niet verschenen", completed: "Afgerond" };

function Treatment() {
  const { id: key } = Route.useParams();
  const id = useSuspenseQuery(dossierQuery(key)).data.patient?.id ?? "";
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["treatment-tab", id],
    queryFn: async () => {
      const [n, p, f] = await Promise.all([
        supabase.from("consult_notes").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
        supabase.from("treatment_plans").select("fields").eq("patient_id", id).maybeSingle(),
        supabase.from("option_lists").select("value, label_nl").eq("list_key", "treatment_plan_fields").order("sort"),
      ]);
      return { notes: n.data ?? [], plan: (p.data?.fields ?? {}) as Record<string, string>, fields: f.data ?? [] };
    },
  });
  const [tab, setTab] = useState(0);
  const [planOpen, setPlanOpen] = useState(false);
  const [focusField, setFocusField] = useState<string>();
  const [standaloneOpen, setStandaloneOpen] = useState(false);
  const go = (i: number) => { setTab(i); document.getElementById(["consulten", "plan", "afspraken"][i] ?? "")?.scrollIntoView({ behavior: "smooth" }); };

  // The consult in progress: the earliest booked appointment that has not ended long ago and has no final note.
  const finals = new Set((data?.notes ?? []).filter((n) => n.status === "final").map((n) => n.appointment_id));
  const current = [...d.appointments].reverse().find((a) => a.status === "booked" && !finals.has(a.id) && new Date(a.ends_at).getTime() > Date.now() - 12 * 3600_000);
  const draft = data?.notes.find((n) => n.appointment_id === current?.id);
  const [soep, setSoep] = useState<Partial<Record<SoepKey, string>>>({});
  const val = (k: SoepKey) => soep[k] ?? draft?.[k] ?? "";
  const save = useMutation({
    mutationFn: async () => {
      if (!current) throw new Error("No current appointment");
      const row = { patient_id: id, appointment_id: current.id, ...Object.fromEntries(SOEP.map(([k]) => [k, val(k)])) };
      const r = draft ? await supabase.from("consult_notes").update(row).eq("id", draft.id) : await supabase.from("consult_notes").insert(row);
      if (r.error) throw r.error;
    },
    onSuccess: async () => { setSoep({}); await qc.invalidateQueries({ queryKey: ["treatment-tab", id] }); toast.success("Opgeslagen"); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const earlier = (data?.notes ?? []).filter((n) => n.status === "final");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-2">{["Consult: evaluatie en plan", "Behandelplan en medicatie", "Afspraken en vervolg"].map((l, i) => <button key={l} type="button" onClick={() => go(i)} className={cn("whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", tab === i ? "bg-primary text-primary-foreground" : "bg-sand")}>{l}</button>)}</div>

      <section id="consulten" className="rounded-[20px] p-6 ring-1 ring-mist">
        <h3 className="text-[17px] font-semibold">Consulten</h3>
        <p className="text-[13px] text-muted-foreground">Per consult een verslag in vaste velden; de arts vult dit in tijdens of direct na het gesprek</p>
        {current ? (
          <div className="mt-5 rounded-[16px] p-5 ring-1 ring-primary">
            <div className="flex items-center justify-between"><p className="text-[14px] font-semibold first-letter:uppercase">{when(current.starts_at)} · {current.new_patient ? "eerste consult" : "consult"} · {current.practitioner?.first_name} {current.practitioner?.last_name}</p>{draft && <span className="rounded-full bg-teal-light px-2.5 py-1 text-[12px] text-primary">Bezig</span>}</div>
            <div className="mt-4 grid grid-cols-2 gap-4">{SOEP.map(([k, l]) => <TextArea key={k} label={l} value={val(k)} onChange={(e) => setSoep({ ...soep, [k]: e.target.value })} />)}</div>
            <div className="mt-4 flex gap-2"><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton><PillButton variant="outline" disabled={save.isPending} onClick={() => save.mutate(undefined, { onSuccess: () => setPlanOpen(true) })}>Opslaan en behandelplan maken</PillButton></div>
          </div>
        ) : <p className="mt-4 text-[14px] text-muted-foreground">Er is nu geen consult gepland.</p>}
        <PillButton variant="outline" className="mt-4" onClick={() => setStandaloneOpen(true)}>Telefonisch of tussentijds consult vastleggen</PillButton>
        <p className="mt-4 text-[13px] text-muted-foreground">Eerdere consulten: {earlier.length ? "" : "geen."}</p>
        {earlier.map((n) => (
          <div key={n.id} className="mt-3 rounded-[14px] bg-sand p-4 text-[13px]">
            <p className="font-semibold">{when(n.occurred_at ?? n.finished_at ?? n.created_at)}{n.appointment_id === null && ` · ${n.time_and_duration}`}</p>
            {n.reason && <p className="mt-1"><span className="text-muted-foreground">Aanleiding: </span>{n.reason}</p>}
            {SOEP.map(([k, l]) => n[k] ? <p key={k} className="mt-1"><span className="text-muted-foreground">{l.split(":")[0]}: </span>{n[k]}</p> : null)}
          </div>
        ))}
      </section>

      <section id="plan" className="rounded-[20px] p-6 ring-1 ring-mist">
        <div><h3 className="text-[17px] font-semibold">Behandelplan en medicatie</h3><p className="text-[13px] text-muted-foreground">{Object.values(data?.plan ?? {}).some(Boolean) ? "Het huidige plan" : "Nog geen plan; wordt gemaakt na het eerste consult"}</p></div>
        <div className="mt-5 flex flex-col">{data?.fields.map((f) => <EditableFieldRow key={f.value} label={f.label_nl} value={data.plan[f.value] ?? ""} onClick={() => { setFocusField(f.value); setPlanOpen(true); }} />)}</div>
        <p className="mt-4 text-[12px] text-muted-foreground">Recepten en bestellingen lopen via de apotheek en eKis; hier staat wat is afgesproken en wanneer de volgende evaluatie is.</p>
      </section>

      <section id="afspraken" className="rounded-[20px] p-6 ring-1 ring-mist">
        <h3 className="text-[17px] font-semibold">Afspraken</h3>
        <table className="mt-4 w-full text-[13px]">
          <thead><tr className="border-b border-mist text-left text-[12px] text-muted-foreground">{["Datum", "Afspraak", "Behandelaar", "Waar", "Status"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2.5 font-normal">{h}</th>)}</tr></thead>
          <tbody>{d.appointments.map((a) => (
            <tr key={a.id} className="border-b border-mist">
              <td className="whitespace-nowrap px-2.5 py-3">{new Date(a.starts_at).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ })}</td>
              <td className="whitespace-nowrap px-2.5">{a.treatment?.name_nl}</td>
              <td className="whitespace-nowrap px-2.5">{a.practitioner?.first_name} {a.practitioner?.last_name}</td>
              <td className="whitespace-nowrap px-2.5">{a.location?.kind === "online" ? <>Online{a.meet_link && <> · <a href={a.meet_link} target="_blank" rel="noreferrer" className="text-primary underline">Meet-link</a></>}</> : a.location?.name}</td>
              <td className="whitespace-nowrap px-2.5">{STATUS[a.status] ?? a.status}</td>
            </tr>
          ))}</tbody>
        </table>
      </section>

      {planOpen && data && <PlanModal id={id} fields={data.fields} plan={data.plan} focusField={focusField} onClose={() => { setPlanOpen(false); setFocusField(undefined); }} />}
      {standaloneOpen && <StandaloneConsultModal patientId={id} practitionerId={current?.practitioner_id ?? d.appointments[0]?.practitioner_id ?? undefined} onClose={() => setStandaloneOpen(false)} />}
    </div>
  );
}

function PlanModal({ id, fields, plan, focusField, onClose }: { id: string; fields: Array<{ value: string; label_nl: string }>; plan: Record<string, string>; focusField: string | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState(plan);
  const save = useMutation({
    mutationFn: async () => { const r = await supabase.from("treatment_plans").upsert({ patient_id: id, fields: v }); if (r.error) throw r.error; },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["treatment-tab", id] }); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open width="lg" initialFocusId={`plan-${focusField ?? fields[0]?.value}`} onOpenChange={(o) => !o && onClose()} title="Behandelplan wijzigen" footer={<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{fields.map((f) => <TextArea key={f.value} id={`plan-${f.value}`} label={f.label_nl} value={v[f.value] ?? ""} onChange={(e) => setV({ ...v, [f.value]: e.target.value })} />)}</div>
    </Modal>
  );
}
