import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { PlusIcon, TextArea, TextField, TextLink } from "@/components/Field";
import { Select } from "@/components/Select";
import { SegmentedControl } from "@/components/SegmentedControl";
import { saveMailTemplate } from "@/data/mail.functions";
import type { MailData } from "@/data/mail";
import type { Org } from "@/data/organisation";
import { blocksOf, mailBlockSchema, mailTemplateSchema, translated, type MailBlock, type MailInput, type MailTemplate } from "@/domain/mail";
import { MailPreview } from "./MailPreview";

export function MailTemplateModal({ template, defaults, data, org, onClose }: { template: MailTemplate | null; defaults?: Partial<MailInput>; data: MailData; org: Org; onClose: () => void }) {
  const qc = useQueryClient();
  const form = useForm<MailInput>({ resolver: zodResolver(mailTemplateSchema), defaultValues: {
    id: template?.id ?? null, name: template?.name ?? "", moment: template?.moment ?? data.options.find((o) => o.list_key === "mail_moment")?.value ?? "",
    scope: (template?.scope ?? "base") as MailInput["scope"], category_id: template?.category_id ?? null, treatment_id: template?.treatment_id ?? null,
    status: (template?.status ?? "draft") as MailInput["status"], subject_nl: template?.subject_nl ?? "", subject_en: template?.subject_en ?? "", description: template?.description ?? "",
    blocks: template ? blocksOf(template) : [], ...defaults,
  } });
  const current = form.watch();
  const [language, setLanguage] = useState("nl");
  const [selected, setSelected] = useState(current.blocks[0]?.id ?? "");
  const [online, setOnline] = useState("online");
  const [patientType, setPatientType] = useState("new");
  const [dragged, setDragged] = useState<string | null>(null);
  const option = (key: string) => data.options.filter((o) => o.list_key === key).map((o) => ({ value: o.value, label: o.label_nl }));
  const treatment = org.treatments.find((t) => t.id === current.treatment_id) ?? org.treatments.find((t) => t.post_questionnaire_key) ?? org.treatments[0];
  const values = { voornaam: "", dag: "", tijd: "", behandeling: treatment ? translated(treatment.name_nl, treatment.name_en, language) : "", duur: String(treatment?.duration_min ?? ""), behandelaar: "", behandelaar_voornaam: "", locatie: "", adres: "", voorbereiding: treatment ? translated(treatment.preparation_nl, treatment.preparation_en, language) : "", nazorg: treatment ? translated(treatment.aftercare_nl, treatment.aftercare_en, language) : "" };
  const save = useMutation({ mutationFn: (input: MailInput) => saveMailTemplate({ data: input }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["mail-templates"] }); toast.success("Sjabloon opgeslagen"); onClose(); }, onError: (e) => toast.error(e.message) });
  const updateBlocks = (blocks: MailBlock[]) => form.setValue("blocks", blocks, { shouldDirty: true });
  const updateBlock = (patch: Partial<MailBlock>) => updateBlocks(current.blocks.map((b) => b.id === selected ? { ...b, ...patch } : b));
  const block = current.blocks.find((b) => b.id === selected);
  const languageKey = (field: "title" | "text" | "button") => `${field}_${language === "en" ? "en" : "nl"}` as "title_nl" | "title_en" | "text_nl" | "text_en" | "button_nl" | "button_en";
  const submit = form.handleSubmit((input) => save.mutate(input), () => {
    requestAnimationFrame(() => document.querySelector('[role="dialog"] [aria-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }));
  });
  return <Modal open width="lg" title={template ? `${template.name}, ${data.options.find((o) => o.list_key === "mail_scope" && o.value === template.scope)?.label_nl ?? ""}` : "Nieuw basissjabloon"} onOpenChange={(open) => !open && onClose()} footer={<>
    {template && <div className="mr-auto"><TextLink tone="warning" onClick={() => save.mutate({ ...current, status: "archived" })}>Verwijderen</TextLink></div>}
    <PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={submit}>Opslaan</PillButton>
  </>}>
    <form onSubmit={submit} className="grid gap-6 md:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-4">
        <TextField label="Naam" {...form.register("name")} aria-invalid={!!form.formState.errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Geldt voor" value={current.scope} options={option("mail_scope")} onChange={(scope) => { form.setValue("scope", scope as MailInput["scope"]); form.setValue("category_id", null); form.setValue("treatment_id", null); }} />
          <Select label="Wanneer" value={current.moment} options={option("mail_moment")} onChange={(v) => form.setValue("moment", v)} />
          {current.scope === "category" && <Select label="Categorie" value={current.category_id ?? ""} options={org.categories.map((c) => ({ value: c.id, label: c.name_nl }))} onChange={(v) => form.setValue("category_id", v)} />}
          {current.scope === "treatment" && <Select label="Behandeling" value={current.treatment_id ?? ""} options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))} onChange={(v) => form.setValue("treatment_id", v)} />}
          <Select label="Taal" value={language} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "Engels" }]} onChange={setLanguage} />
          <Select label="Status" value={current.status} options={option("mail_status")} onChange={(v) => form.setValue("status", v as MailInput["status"])} />
        </div>
        <TextField label="Onderwerp" value={language === "en" ? current.subject_en : current.subject_nl} aria-invalid={!!form.formState.errors.subject_nl} onChange={(e) => form.setValue(language === "en" ? "subject_en" : "subject_nl", e.target.value)} />
        <div className="text-sm font-medium">Opbouw van de mail</div>
        <div className="flex flex-col gap-2">
          {current.blocks.map((b, index) => <div key={b.id} draggable onDragStart={() => setDragged(b.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = current.blocks.findIndex((x) => x.id === dragged); if (from < 0) return; const next = [...current.blocks]; const moved = next.splice(from, 1)[0]; if (moved) next.splice(index, 0, moved); updateBlocks(next); setDragged(null); }} className={`flex items-center gap-2 rounded-[14px] border p-2 ${selected === b.id ? "border-primary bg-teal-light" : "border-line"}`}>
            <PillButton size="sm" variant="ghost" onClick={() => setSelected(b.id)} className="min-w-0 flex-1 justify-start truncate">{b.title_nl || option("mail_block_type").find((o) => o.value === b.type)?.label}</PillButton>
            <PillButton size="sm" variant="ghost" aria-label="Blok omhoog" disabled={index === 0} onClick={() => { const next = [...current.blocks]; const moved = next.splice(index, 1)[0]; if (moved) next.splice(index - 1, 0, moved); updateBlocks(next); }}>↑</PillButton>
            <PillButton size="sm" variant="ghost" aria-label="Blok verwijderen" onClick={() => updateBlocks(current.blocks.filter((x) => x.id !== b.id))}>×</PillButton>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-2">{option("mail_block_type").map((type) => <PillButton key={type.value} size="sm" variant="outline" onClick={() => { const b = mailBlockSchema.parse({ id: crypto.randomUUID(), type: type.value, condition: "always" }); updateBlocks([...current.blocks, b]); setSelected(b.id); }}><PlusIcon />{type.label}</PillButton>)}</div>
        {block && <div className="flex flex-col gap-3 rounded-[14px] bg-sand p-4">
          <Select label="Tonen" value={block.condition} options={option("mail_condition")} onChange={(condition) => updateBlock({ condition })} />
          {block.type !== "divider" && <TextField label="Kop" value={block[languageKey("title")]} onChange={(e) => updateBlock({ [languageKey("title")]: e.target.value })} />}
          {!['divider', 'image', 'details'].includes(block.type) && <TextArea label="Tekst" value={block[languageKey("text")]} onChange={(e) => updateBlock({ [languageKey("text")]: e.target.value })} />}
          {['button', 'card'].includes(block.type) && <><TextField label="Knop" value={block[languageKey("button")]} onChange={(e) => updateBlock({ [languageKey("button")]: e.target.value })} /><TextField label="Link" value={block.url} onChange={(e) => updateBlock({ url: e.target.value })} /></>}
        </div>}
        {Object.values(form.formState.errors).length > 0 && <p role="alert" className="text-sm text-warning">{form.formState.errors.subject_nl?.message ?? form.formState.errors.scope?.message ?? "Vul de ontbrekende velden in."}</p>}
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2"><SegmentedControl label="Afspraak" value={online} onChange={setOnline} options={[{ value: "online", label: "Online" }, { value: "clinic", label: "Kliniek" }]} /><SegmentedControl label="Patiënt" value={patientType} onChange={setPatientType} options={[{ value: "new", label: "Nieuwe patiënt" }, { value: "existing", label: "Bestaande patiënt" }]} /></div>
        <MailPreview blocks={current.blocks} language={language} values={values} situation={{ online: online === "online", existingPatient: patientType === "existing", questionnaire: !!treatment?.post_questionnaire_key, preparation: !!values.voorbereiding }} />
      </div>
    </form>
  </Modal>;
}