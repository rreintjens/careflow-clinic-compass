import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { TextArea, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { savePatientLabels } from "@/data/consult-steps.functions";
import type { Dossier } from "@/data/patients";
import { formatClinicalDate } from "@/domain/time";
import { supabase } from "@/integrations/supabase/client";

const labelsQuery = queryOptions({
  queryKey: ["patient-label-options"],
  queryFn: async () => {
    const r = await supabase.from("option_lists").select("value, label_nl").eq("list_key", "patient_label").order("sort");
    if (r.error) throw r.error;
    return r.data.map((x) => ({ value: x.value, label: x.label_nl }));
  },
});

const waitlistQuery = (patientId: string) => queryOptions({
  queryKey: ["waitlist", patientId],
  queryFn: async () => {
    const r = await supabase.from("waitlist_entries").select("id, note, status, created_at, treatment:treatments(name_nl)").eq("patient_id", patientId).order("created_at", { ascending: false });
    if (r.error) throw r.error;
    return r.data;
  },
});

const treatmentsQuery = queryOptions({
  queryKey: ["waitlist-treatments"],
  queryFn: async () => {
    const r = await supabase.from("treatments").select("id, name_nl").eq("status", "active").order("name_nl");
    if (r.error) throw r.error;
    return r.data.map((t) => ({ value: t.id, label: t.name_nl }));
  },
});

/** Waarschuwingen (labels), Wachtlijst en Zorgverleners on the Overzicht tab. */
export function PatientSideCards({ d }: { d: Dossier }) {
  const p = d.patient;
  if (!p) return null;
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <WarningsCard patientId={p.id} labels={p.labels ?? []} blocked={p.online_booking_blocked} />
      <WaitlistCard patientId={p.id} />
      <ProvidersCard d={d} />
    </div>
  );
}

function WarningsCard({ patientId, labels, blocked }: { patientId: string; labels: string[]; blocked: boolean }) {
  const qc = useQueryClient();
  const { data: options = [] } = useQuery(labelsQuery);
  const [value, setValue] = useState(labels);
  const mut = useMutation({
    mutationFn: (v: string[]) => savePatientLabels({ data: { patientId, labels: v } }),
    onSuccess: () => { toast.success("Waarschuwingen opgeslagen"); void qc.invalidateQueries({ queryKey: ["dossier"] }); },
    onError: (e) => toast.error(e.message),
  });
  const save = (v: string[]) => { setValue(v); mut.mutate(v); };
  return (
    <Card title="Waarschuwingen" description="Zichtbaar bij elke afspraak en boeking van deze patiënt.">
      <MultiSelect label="Labels" value={value} onChange={save} options={options} />
      {blocked && <p className="mt-3 rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning">Online boeken is uitgezet voor deze patiënt; de boekingspagina verwijst naar de receptie.</p>}
    </Card>
  );
}

function WaitlistCard({ patientId }: { patientId: string }) {
  const qc = useQueryClient();
  const { data: entries = [] } = useQuery(waitlistQuery(patientId));
  const { data: treatments = [] } = useQuery(treatmentsQuery);
  const [adding, setAdding] = useState(false);
  const [treatment, setTreatment] = useState("");
  const [note, setNote] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["waitlist", patientId] });
  const add = useMutation({
    mutationFn: async () => {
      const r = await supabase.from("waitlist_entries").insert({ patient_id: patientId, treatment_id: treatment || null, note });
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Op de wachtlijst gezet"); setAdding(false); setNote(""); setTreatment(""); void refresh(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const resolve = useMutation({
    mutationFn: async (id: string) => {
      const r = await supabase.from("waitlist_entries").update({ status: "resolved" }).eq("id", id);
      if (r.error) throw r.error;
    },
    onSuccess: () => { toast.success("Van de wachtlijst gehaald"); void refresh(); },
    onError: () => toast.error("Bijwerken is niet gelukt"),
  });
  const open = entries.filter((e) => e.status === "open");
  return (
    <Card title="Wachtlijst" description="Patiënten die eerder een plek willen.">
      {open.length === 0 && <p className="text-sm text-muted-foreground">Niet op de wachtlijst.</p>}
      <div className="flex flex-col gap-2">
        {open.map((e) => (
          <div key={e.id} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
            <span className="flex-1">{e.treatment?.name_nl ?? "Willekeurige behandeling"}{e.note ? ` · ${e.note}` : ""}<span className="block text-[12px] text-muted-foreground">sinds {formatClinicalDate(e.created_at)}</span></span>
            <TextLink onClick={() => resolve.mutate(e.id)}>Van wachtlijst halen</TextLink>
          </div>
        ))}
      </div>
      <div className="mt-3"><PillButton size="sm" variant="outline" onClick={() => setAdding(true)}>Zet op wachtlijst</PillButton></div>
      {adding && (
        <Modal open onOpenChange={(o) => !o && setAdding(false)} title="Zet op wachtlijst"
          footer={<><PillButton variant="outline" onClick={() => setAdding(false)}>Annuleren</PillButton><PillButton disabled={add.isPending} onClick={() => add.mutate()}>Opslaan</PillButton></>}>
          <div className="flex flex-col gap-4">
            <Select label="Behandeling" value={treatment} onChange={setTreatment} options={treatments} />
            <TextArea label="Notitie (bijvoorbeeld voorkeursdag)" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </Modal>
      )}
    </Card>
  );
}

function ProvidersCard({ d }: { d: Dossier }) {
  const seen = new Map<string, { name: string; count: number; last: string }>();
  for (const a of d.appointments) {
    if (!a.practitioner) continue;
    const name = `${a.practitioner.first_name} ${a.practitioner.last_name}`;
    const cur = seen.get(name) ?? { name, count: 0, last: a.starts_at };
    cur.count += 1;
    if (a.starts_at > cur.last) cur.last = a.starts_at;
    seen.set(name, cur);
  }
  const providers = [...seen.values()].sort((a, b) => b.last.localeCompare(a.last));
  return (
    <Card title="Zorgverleners" description="Wie deze patiënt behandelt.">
      {providers.length === 0 && !d.patient?.gp_name && <p className="text-sm text-muted-foreground">Nog geen behandelaars.</p>}
      <div className="flex flex-col gap-2">
        {providers.map((x) => (
          <div key={x.name} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
            <span className="flex-1">{x.name}<span className="block text-[12px] text-muted-foreground">Behandelaar · {x.count}× · laatst {formatClinicalDate(x.last)}</span></span>
          </div>
        ))}
        {d.patient?.gp_name && (
          <div className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
            <span className="flex-1">{d.patient.gp_name}<span className="block text-[12px] text-muted-foreground">Huisarts</span></span>
          </div>
        )}
      </div>
    </Card>
  );
}
