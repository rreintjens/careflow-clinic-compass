import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchField, StatusMark, Tag, TextField, thCls, tdCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { opts, optLabel, orgQuery } from "@/data/organisation";
import { createQuestionnaire, defOf, importFlow, publishedOf, questionnairesQuery, workingVersion } from "@/data/questionnaires";
import { questionCount, type FlowFile } from "@/domain/questionnaire/engine";

export const Route = createFileRoute("/_authenticated/boekingsflow/vragenlijsten/")({
  head: () => ({ meta: [{ title: "Vragenlijsten · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(questionnairesQuery), context.queryClient.ensureQueryData(orgQuery)]),
  component: Page,
});

function Page() {
  const { data } = useSuspenseQuery(questionnairesQuery);
  const { data: org } = useSuspenseQuery(orgQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [moment, setMoment] = useState("all");
  const [treatment, setTreatment] = useState("all");
  const [newOpen, setNewOpen] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const linked = (key: string, m: string) => org.treatments.filter((t) => (m === "after_booking" ? t.post_questionnaire_key : t.pre_questionnaire_key) === key);
  const rows = data.questionnaires.filter((x) =>
    (!q || x.name.toLowerCase().includes(q.toLowerCase())) && (moment === "all" || x.moment === moment) && (treatment === "all" || linked(x.key, x.moment).some((t) => t.id === treatment)));

  const imp = useMutation({
    mutationFn: async (f: File) => {
      const json = JSON.parse(await f.text()) as FlowFile;
      const key = String((json.meta as Record<string, unknown> | undefined)?.["treatment"] ?? f.name.replace(/\.json$/, "")).replace(/[^a-z0-9]+/gi, "_").toLowerCase();
      await importFlow(json, key, false);
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: questionnairesQuery.queryKey }); toast.success("Geïmporteerd als concept"); },
    onError: (e) => toast.error(e instanceof Error ? `Importeren is niet gelukt: ${e.message}` : "Importeren is niet gelukt"),
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vragenlijsten"
        description="Een vragenlijst hoort bij één of meer behandelingen, en wordt vóór het boeken (de triage) of na het boeken (de medische vragenlijst) ingevuld."
        actions={<>
          <PillButton size="lg" variant="outline" onClick={() => file.current?.click()} disabled={imp.isPending}>Importeren</PillButton>
          <PillButton size="lg" onClick={() => setNewOpen(true)}><PlusIcon />Nieuwe vragenlijst</PillButton>
        </>}
      />
      <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) imp.mutate(f); e.target.value = ""; }} />
      <div className="flex items-center gap-3">
        <SearchField className="w-[300px]" placeholder="Zoek een vragenlijst" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Moment" value={moment} onChange={setMoment} options={[{ value: "all", label: "Vóór en na het boeken" }, ...opts(org, "questionnaire_moment")]} className="w-[200px] [&>label]:sr-only" />
        <Select label="Behandeling" value={treatment} onChange={setTreatment} options={[{ value: "all", label: "Alle behandelingen" }, ...org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))]} className="w-[220px] [&>label]:sr-only" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-line">{["Vragenlijst", "Moment", "Gekoppeld aan", "Omvang", "Uitkomst", "Status", ""].map((h) => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((x) => {
              const def = defOf(workingVersion(data, x.id));
              const ts = linked(x.key, x.moment);
              const pub = publishedOf(data, x.id);
              return (
                <tr key={x.id}>
                  <td className={tdCls}>{x.name}</td>
                  <td className={tdCls}><Tag tone={x.moment === "after_booking" ? "sand" : "teal"}>{optLabel(org, "questionnaire_moment", x.moment)}</Tag></td>
                  <td className={tdCls}>{ts.length === 0 ? "Nog niet gekoppeld" : ts.length === 1 ? ts[0]?.name_nl : `${ts[0]?.name_nl} en ${ts.length - 1} andere`}</td>
                  <td className={tdCls}>{def ? `${questionCount(def)} vragen` : ""}</td>
                  <td className={tdCls}>{x.moment === "after_booking" ? "Naar het dossier" : "Groen of rood"}</td>
                  <td className={tdCls}><span className="flex items-center gap-2"><StatusMark kind={pub ? "ok" : "warn"} />{optLabel(org, "questionnaire_status", pub ? "published" : "draft")}</span></td>
                  <td className={tdCls}><Link to="/boekingsflow/vragenlijsten/$id" params={{ id: x.id }} className="text-primary underline">Wijzig</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {newOpen && <NewModal flows={data.flows} sort={data.questionnaires.length} momentOptions={opts(org, "questionnaire_moment")} onClose={() => setNewOpen(false)} />}
    </div>
  );
}

function NewModal({ flows, sort, momentOptions, onClose }: { flows: Array<{ id: string; key: string }>; sort: number; momentOptions: Array<{ value: string; label: string }>; onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [moment, setMoment] = useState(momentOptions[0]?.value ?? "before_booking_confirmation");
  const [flow, setFlow] = useState(flows[0]?.id ?? "");
  const save = useMutation({
    mutationFn: () => {
      const key = name.trim().toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      return createQuestionnaire(flow, key, name.trim(), moment, sort);
    },
    onSuccess: async (id) => { await qc.invalidateQueries({ queryKey: questionnairesQuery.queryKey }); onClose(); navigate({ to: "/boekingsflow/vragenlijsten/$id", params: { id } }); },
    onError: () => toast.error("Aanmaken is niet gelukt; bestaat de naam al?"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Nieuwe vragenlijst" description="Je begint met een lege conceptversie."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || !flow || save.isPending} onClick={() => save.mutate()}>Aanmaken</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} className="col-span-2" />
        <Select label="Moment" value={moment} onChange={setMoment} options={momentOptions} />
        <Select label="Hoort bij flow" value={flow} onChange={setFlow} options={flows.map((f) => ({ value: f.id, label: f.key.replace(/[_-]+/g, " ") }))} help="Grenswaarden en berekende velden komen uit de flow." />
      </div>
    </Modal>
  );
}
