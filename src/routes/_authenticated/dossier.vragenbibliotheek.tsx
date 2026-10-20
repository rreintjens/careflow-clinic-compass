import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { DataTable, ListPage, RowChevron } from "@/components/ListPage";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { PlusIcon, SearchField, Tag, TextField, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { dossierOptionsQuery, libraryQuery, libraryUsageQuery, optsOf, templatesQuery, type LibraryRow } from "@/data/dossier";
import { saveLibraryQuestion } from "@/data/dossier.functions";
import { conceptMessage, nextCode, questionnaireCodes, templateUsesCode } from "@/domain/dossier-templates";
import type { QuestionnaireDef } from "@/domain/questionnaire/engine";

const TITLE = "Vragenbibliotheek · The Body Clinic";
const DESC = "Eén bibliotheek met vragen voor vragenlijsten en dossiersjablonen.";
export const Route = createFileRoute("/_authenticated/dossier/vragenbibliotheek")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([libraryQuery, libraryUsageQuery, templatesQuery, dossierOptionsQuery].map((q) => context.queryClient.ensureQueryData(q as typeof libraryQuery))),
  component: LibraryPage,
});

type Usage = { templates: Array<{ id: string; name: string }>; questionnaires: Array<{ id: string; name: string }> };

function useUsage() {
  const { data: usage } = useSuspenseQuery(libraryUsageQuery);
  const { data: t } = useSuspenseQuery(templatesQuery);
  return (code: string): Usage => ({
    templates: t.templates.filter((tp) => t.versions.some((v) => v.template_id === tp.id && v.status !== "archived" && templateUsesCode(v.content, code))),
    questionnaires: usage.questionnaires.filter((q) => usage.versions.some((v) => v.questionnaire_id === q.id && questionnaireCodes(v.definition as unknown as QuestionnaireDef).includes(code))),
  });
}

function LibraryPage() {
  const { data: rows } = useSuspenseQuery(libraryQuery);
  const { data: optRows } = useSuspenseQuery(dossierOptionsQuery);
  const usageOf = useUsage();
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("");
  const [edit, setEdit] = useState<LibraryRow | null>(null);
  const groups = optsOf(optRows, "library_question_group");
  const types = optsOf(optRows, "library_question_type");
  const label = (list: Array<{ value: string; label: string }>, v: string) => list.find((o) => o.value === v)?.label ?? v;
  const shown = rows.filter((r) => (!group || r.grp === group) && `${r.code} ${r.text_nl}`.toLowerCase().includes(search.toLowerCase()));
  const blank = (): LibraryRow => ({ id: "", code: nextCode(rows.map((r) => r.code)), text_nl: "", text_en: "", qtype: types[0]?.value ?? "yes_no", grp: group || (groups[0]?.value ?? "anamnese"), options: [], condition: null, is_example: false, sort: rows.length + 1 });

  return (
    <ListPage>
      <PageHeader title="Vragenbibliotheek" description="Vragen die je in vragenlijsten en dossiersjablonen gebruikt. Een wijziging maakt een concept van alles wat de vraag gebruikt." actions={<PillButton onClick={() => setEdit(blank())}><PlusIcon />Nieuwe vraag</PillButton>} />
      <div className="flex flex-wrap items-center gap-3">
        <SearchField aria-label="Zoek op code of vraag" placeholder="Zoek op code of vraag" value={search} onChange={(e) => setSearch(e.target.value)} className="w-[300px]" />
        <Select label="Groep" inline className="w-[220px]" value={group} onChange={setGroup} options={[{ value: "", label: "Alle groepen" }, ...groups]} />
        <span className="ml-auto text-xs text-muted-foreground">{shown.length} vragen</span>
      </div>
      <DataTable count={shown.length} label="vragen">
        <table className="w-full min-w-[900px]">
          <thead><tr className="border-b border-line"><th className={thCls}>Code</th><th className={thCls}>Vraag</th><th className={thCls}>Soort</th><th className={thCls}>Groep</th><th className={thCls}>Gebruikt in</th><th className={thCls}><span className="sr-only">Openen</span></th></tr></thead>
          <tbody>
            {shown.map((r) => {
              const u = usageOf(r.code);
              return (
                <tr key={r.id} className="border-b border-line">
                  <td className={`${tdCls} font-mono text-xs`}>{r.code}</td>
                  <td className={tdCls}>{r.text_nl}{r.is_example && <span className="ml-2 text-xs text-muted-foreground">voorbeeldtekst</span>}</td>
                  <td className={tdCls}>{label(types, r.qtype)}</td>
                  <td className={tdCls}>{label(groups, r.grp)}</td>
                  <td className={tdCls}><div className="flex flex-wrap gap-1.5">{u.templates.map((t) => <Tag key={t.id}>{t.name}</Tag>)}{u.questionnaires.map((q) => <Tag key={q.id} tone="sand">{q.name}</Tag>)}{!u.templates.length && !u.questionnaires.length && <span className="text-muted-foreground">–</span>}</div></td>
                  <td className={tdCls}><button type="button" data-row-action aria-label={`${r.code} wijzigen`} onClick={() => setEdit(r)} className="text-primary"><RowChevron /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </DataTable>
      {edit && <LibraryModal initial={edit} usage={edit.id ? usageOf(edit.code) : { templates: [], questionnaires: [] }} onClose={() => setEdit(null)} />}
    </ListPage>
  );
}

function LibraryModal({ initial, usage, onClose }: { initial: LibraryRow; usage: Usage; onClose: () => void }) {
  const { data: optRows } = useSuspenseQuery(dossierOptionsQuery);
  const [f, setF] = useState(initial);
  const [optionsText, setOptionsText] = useState(initial.options.map((o) => o.label).join("\n"));
  const qc = useQueryClient();
  const saveFn = useServerFn(saveLibraryQuestion);
  const hasOptions = f.qtype === "choice" || f.qtype === "multi";
  const msg = initial.id ? conceptMessage(usage.templates.length, usage.questionnaires.length) : null;
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: f.id || null, code: f.code, text_nl: f.text_nl, text_en: f.text_en || null, qtype: f.qtype, grp: f.grp, condition: f.condition,
      options: hasOptions ? optionsText.split("\n").map((l) => l.trim()).filter(Boolean).map((l, i) => ({ value: f.options[i]?.value ?? String(i + 1), label: l })) : [] } }),
    onSuccess: async (r) => {
      await Promise.all([libraryQuery, libraryUsageQuery, templatesQuery].map((q) => qc.invalidateQueries({ queryKey: q.queryKey })));
      toast.success(conceptMessage(r.templates, r.questionnaires)?.replace("Wijzigen maakt", "Opgeslagen; er is") .replace(" van ", " gemaakt van ") ?? "Opgeslagen");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  const condField = optsOf(optRows, "library_condition_field");
  const condValue = optsOf(optRows, "library_condition_value");
  return (
    <Modal open width="lg" title={initial.id ? `Vraag ${initial.code}` : "Nieuwe vraag"} description={msg ?? undefined} onOpenChange={(o) => !o && onClose()}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={() => save.mutate()} disabled={save.isPending || !f.text_nl.trim()}>Opslaan</PillButton></>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} disabled={!!initial.id} />
        <Select label="Groep" value={f.grp} onChange={(v) => setF({ ...f, grp: v })} options={optsOf(optRows, "library_question_group")} />
        <div className="col-span-2"><TextField label="Vraag (NL)" value={f.text_nl} onChange={(e) => setF({ ...f, text_nl: e.target.value })} /></div>
        <div className="col-span-2"><TextField label="Vraag (EN)" value={f.text_en ?? ""} onChange={(e) => setF({ ...f, text_en: e.target.value })} /></div>
        <Select label="Soort" value={f.qtype} onChange={(v) => setF({ ...f, qtype: v })} options={optsOf(optRows, "library_question_type")} />
        <Select label="Alleen tonen als" value={f.condition ? `${f.condition.field}:${f.condition.equals}` : ""} onChange={(v) => setF({ ...f, condition: v ? { field: v.split(":")[0]!, equals: v.split(":")[1]! } : null })}
          options={[{ value: "", label: "Altijd tonen" }, ...condField.flatMap((cf) => condValue.map((cv) => ({ value: `${cf.value}:${cv.value}`, label: `${cf.label} = ${cv.label.toLowerCase()}` })))]} />
        {hasOptions && <label className="col-span-2 flex flex-col gap-1.5 text-sm"><span className="font-medium">Antwoorden, één per regel</span><textarea value={optionsText} onChange={(e) => setOptionsText(e.target.value)} rows={5} className="rounded-[14px] bg-sand px-4 py-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>}
        {msg && <p className="col-span-2 rounded-[14px] bg-warning-bg px-4 py-3 text-sm text-warning">{msg}: {[...usage.templates, ...usage.questionnaires].map((x) => x.name).join(", ")}.</p>}
      </div>
    </Modal>
  );
}
