import { MeasurementModal } from "@/features/dossier/MeasurementModal";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { EditableFieldRow, TextArea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { dossierQuery } from "@/data/patients";
import type { QuestionnaireDef } from "@/domain/questionnaire/engine";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { measurementsQuery } from "@/data/measurements";
import { measurementWithBmi } from "@/domain/measurements";
import { answerText } from "@/domain/questionnaire/answers";
import { formatClinicalDate } from "@/domain/time";

export const Route = createFileRoute("/_authenticated/patienten/$id/medisch")({ head: () => ({ meta: [{ title: "Medisch · Dossier · The Body Clinic" }, { name: "description", content: "Intake, anamnese en metingen in het patiëntendossier." }, { property: "og:title", content: "Medisch dossier · The Body Clinic" }, { property: "og:description", content: "Intake, anamnese en metingen in het patiëntendossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Medical });

type Sig = { item: string };
const fmtDate = (s: string) => formatClinicalDate(s);

function useMedical(id: string) {
  return useQuery({
    queryKey: ["medical", id],
    queryFn: async () => {
      const d = (await supabase.from("anamnesis").select("fields").eq("patient_id", id).maybeSingle()).data;
      const f = (await supabase.from("option_lists").select("value, label_nl").eq("list_key", "anamnesis_fields").order("sort")).data ?? [];
      return { anamnesis: (d?.fields ?? {}) as Record<string, string>, fields: f };
    },
  });
}

function Medical() {
  const { id: key } = Route.useParams();
  const id = useSuspenseQuery(dossierQuery(key)).data.patient?.id ?? "";
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const versionIds = [...new Set(d.sets.map((s) => s.version_id).filter(Boolean))] as string[];
  const { data: defs = {} } = useQuery({
    queryKey: ["qdefs", versionIds],
    queryFn: async () => Object.fromEntries(((await supabase.from("questionnaire_versions").select("id, definition").in("id", versionIds)).data ?? []).map((v) => [v.id, v.definition as unknown as QuestionnaireDef])),
    enabled: versionIds.length > 0,
  });
  const { data: med } = useMedical(id);
  const { data: measurements = [] } = useQuery(measurementsQuery(id));
  const [tab, setTab] = useState(0);
  const [edit, setEdit] = useState<"anamnesis" | "measure" | null>(null);
  const [focusField, setFocusField] = useState<string>();
  const sections = ["intake", "anamnese", "metingen"];
  const go = (i: number) => { setTab(i); document.getElementById(sections[i] ?? "")?.scrollIntoView({ behavior: "smooth" }); };

  const tri = d.sets.find((s) => s.questionnaire_key === "triage");
  const ta = (tri?.answers ?? {}) as Record<string, unknown>;
  const triRow = tri && ta["weight_kg"] ? [{ id: "triage", measured_on: tri.created_at, weight_kg: Number(ta["weight_kg"]), height_cm: Number(ta["height_cm"]) || null, waist_cm: Number(ta["waist_cm"]) || null, bp_systolic: null, bp_diastolic: null, pulse: null, source: "triage" }] : [];
  const rows = [...triRow, ...measurements];
  const intake = d.sets.filter((s) => s.status === "completed").slice().reverse();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex min-w-0 gap-2 overflow-x-auto">{["1 Intake: wat de patiënt invulde", "2 Anamnese: aanvullen", "3 Metingen"].map((l, i) => <button key={l} type="button" onClick={() => go(i)} className={cn("shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", tab === i ? "bg-primary text-primary-foreground" : "bg-sand")}>{l}</button>)}</div>

      <section id="intake" className="rounded-[20px] p-6 ring-1 ring-mist">
        <h3 className="text-[17px] font-semibold">Intake: triage en medische vragenlijst</h3>
        <p className="text-[13px] text-muted-foreground">Alle antwoorden zoals de patiënt ze gaf; signalen zijn gemarkeerd</p>
        {intake.length === 0 && <p className="mt-4 text-[14px] text-muted-foreground">Nog geen ingevulde vragenlijst.</p>}
        {intake.map((s) => {
          const def = s.version_id ? defs[s.version_id] : undefined;
          const ans = (s.answers ?? {}) as Record<string, unknown>;
          const sig = new Set((Array.isArray(s.signals) ? (s.signals as Sig[]) : []).map((x) => x.item));
          const items = (def?.pages ?? []).flatMap((p) => p.items ?? []).filter((it) => it.type !== "answer_summary" && it.type !== "checkbox_required" && answerText(it, ans) !== "");
          return (
            <div key={s.id} className="mt-5">
              <p className="mb-2 text-[14px] font-semibold">{def?.name ?? s.questionnaire_key}, {fmtDate(s.completed_at ?? s.created_at)}</p>
              <dl className="grid grid-cols-1 gap-x-6">
                {items.map((it) => (
                  <div key={it.id} className="grid min-w-0 gap-1 border-b border-mist py-2.5 text-[13px] sm:grid-cols-[200px_minmax(0,1fr)] sm:gap-4">
                    <dt className="text-muted-foreground">{it.text}</dt>
                    <dd>{answerText(it, ans)}{sig.has(it.id) && <span className="ml-2 whitespace-nowrap rounded-full bg-signal px-2.5 py-0.5 text-[11px] ring-1 ring-signal-border">signaal</span>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </section>

      <section id="anamnese" className="rounded-[20px] p-6 ring-1 ring-mist">
        <div><h3 className="text-[17px] font-semibold">Anamnese</h3><p className="text-[13px] text-muted-foreground">Vaste velden: vult de arts in of aan tijdens het consult</p></div>
        <div className="mt-5 flex flex-col">
          {med?.fields.map((f) => <EditableFieldRow key={f.value} label={f.label_nl} value={med.anamnesis[f.value] ?? ""} onClick={() => { setFocusField(f.value); setEdit("anamnesis"); }} />)}
        </div>
      </section>

      <section id="metingen" className="rounded-[20px] p-6 ring-1 ring-mist">
        <h3 className="text-[17px] font-semibold">Metingen en lichamelijk onderzoek</h3>
        <p className="text-[13px] text-muted-foreground">Per consult; de eerste rij komt uit de triage</p>
        <div className="min-w-0 overflow-x-auto"><table className="mt-4 w-full min-w-[560px] text-[13px]">
          <thead><tr className="border-b border-mist text-left text-[12px] text-muted-foreground">{["Datum", "Gewicht", "BMI", "Buikomvang", "Bloeddruk", "Pols", "Door"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2.5 font-normal">{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((m) => {
              const calculated = measurementWithBmi(m, rows);
              const bmi = calculated.bmi === null ? "–" : calculated.bmi.toFixed(1).replace(".", ",");
              return <tr key={m.id} className="border-b border-mist">{[fmtDate(m.measured_on), m.weight_kg ? `${String(m.weight_kg).replace(".", ",")} kg` : "–", bmi, m.waist_cm ? `${m.waist_cm} cm` : "–", m.bp_systolic ? `${m.bp_systolic}/${m.bp_diastolic ?? ""}` : "–", m.pulse ?? "–", m.source === "triage" ? "Patiënt, bij het boeken" : "Medewerker"].map((v, i) => <td key={i} className="whitespace-nowrap px-2.5 py-3">{v}</td>)}</tr>;
            })}
          </tbody>
        </table></div>
        <PillButton variant="outline" className="mt-4" onClick={() => setEdit("measure")}>Meting toevoegen</PillButton>
        {rows.length < 2 && <p className="mt-2 text-[12px] text-muted-foreground">Hier komt de grafiek van het gewichtsverloop zodra er twee metingen zijn.</p>}
      </section>

      {edit === "anamnesis" && med && <AnamnesisModal id={id} med={med} focusField={focusField} onClose={() => setEdit(null)} />}
      {edit === "measure" && <MeasurementModal id={id} height={rows.filter((m) => m.height_cm).at(-1)?.height_cm ?? null} onClose={() => setEdit(null)} />}
    </div>
  );
}

function AnamnesisModal({ id, med, focusField, onClose }: { id: string; med: NonNullable<ReturnType<typeof useMedical>["data"]>; focusField: string | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const [v, setV] = useState(med.anamnesis);
  const save = useMutation({
    mutationFn: async () => { const r = await supabase.from("anamnesis").upsert({ patient_id: id, fields: v }); if (r.error) throw r.error; },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["medical", id] }); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open width="lg" initialFocusId={`anamnesis-${focusField}`} onOpenChange={(o) => !o && onClose()} title="Anamnese wijzigen" footer={<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{med.fields.map((f) => <TextArea key={f.value} id={`anamnesis-${f.value}`} label={f.label_nl} value={v[f.value] ?? ""} onChange={(e) => setV({ ...v, [f.value]: e.target.value })} />)}</div>
    </Modal>
  );
}

