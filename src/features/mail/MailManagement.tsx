import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PillButton } from "@/components/PillButton";
import { PlusIcon, SearchField, Tag, TextLink } from "@/components/Field";
import { Select } from "@/components/Select";
import { SegmentedControl } from "@/components/SegmentedControl";
import { mailQuery } from "@/data/mail";
import { orgQuery } from "@/data/organisation";
import { blocksOf, resolveMail, translated, type MailInput, type MailTemplate } from "@/domain/mail";
import { MailTemplateModal } from "./MailTemplateModal";

export function MailManagement({ treatmentView = false }: { treatmentView?: boolean }) {
  const { data } = useSuspenseQuery(mailQuery);
  const { data: org } = useSuspenseQuery(orgQuery);
  const [query, setQuery] = useState("");
  const [moment, setMoment] = useState("all");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [treatmentId, setTreatmentId] = useState(org.treatments[0]?.id ?? "");
  const [language, setLanguage] = useState("nl");
  const [editing, setEditing] = useState<{ template: MailTemplate | null; defaults?: Partial<MailInput> } | null>(null);
  const options = (key: string) => data.options.filter((o) => o.list_key === key);
  const treatment = org.treatments.find((t) => t.id === treatmentId);
  const categoryIds = org.categoryLinks.filter((l) => l.treatment_id === treatmentId).map((l) => l.category_id);
  const visible = data.templates.filter((t) => t.name.toLowerCase().includes(query.toLowerCase()) && (moment === "all" || t.moment === moment) && (status === "all" || t.status === status) && (category === "all" || t.scope === "base" || t.category_id === category || org.categoryLinks.some((link) => link.category_id === category && link.treatment_id === t.treatment_id)));
  const deviation = (base: MailTemplate, treatment_id: string | null = null) => setEditing({ template: null, defaults: { name: base.name, moment: base.moment, scope: treatment_id ? "treatment" : "category", category_id: null, treatment_id, subject_nl: base.subject_nl, subject_en: base.subject_en, description: base.description, blocks: blocksOf(base) } });
  const row = (t: MailTemplate) => <div key={t.id} className={`flex flex-wrap items-center gap-3 rounded-[14px] py-3 ${t.scope === "base" ? "border-b border-line" : "ml-7 bg-sand px-4"}`}>
    <div className="min-w-[180px] flex-1"><h3 className="text-[15px] font-semibold">{t.scope === "treatment" ? org.treatments.find((x) => x.id === t.treatment_id)?.name_nl ?? t.name : t.scope === "category" ? org.categories.find((x) => x.id === t.category_id)?.name_nl ?? t.name : t.name}</h3><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.description}</p></div>
    <Tag tone="sand">{options("mail_scope").find((o) => o.value === t.scope)?.label_nl}</Tag><Tag>NL</Tag><Tag tone={t.subject_en.trim() ? "teal" : "warning"}>EN</Tag><Tag tone={t.status === "active" ? "teal" : "warning"}>{options("mail_status").find((o) => o.value === t.status)?.label_nl}</Tag><TextLink onClick={() => setEditing({ template: t })}>Wijzig</TextLink>
  </div>;
  return <div className="flex flex-col gap-6">
    <div className="flex flex-wrap items-center justify-between gap-4"><h1 className="text-[28px] font-semibold">E-mails en sjablonen</h1><div className="flex flex-wrap items-center gap-3"><Link to="/boekingsflow/e-mails"><PillButton variant={!treatmentView ? "primary" : "outline"}>Per moment</PillButton></Link><Link to="/boekingsflow/e-mails/behandeling"><PillButton variant={treatmentView ? "primary" : "outline"}>Per behandeling</PillButton></Link>{!treatmentView && <PillButton onClick={() => setEditing({ template: null })}><PlusIcon />Nieuw basissjabloon</PillButton>}</div></div>
    {treatmentView ? <>
      <div className="flex flex-wrap gap-4"><Select label="Behandeling" value={treatmentId} onChange={setTreatmentId} options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))} className="min-w-[260px]" /><Select label="Taal" value={language} onChange={setLanguage} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "Engels" }]} /></div>
      <div className="divide-y divide-line">{options("mail_moment").map((m) => {
        const resolved = resolveMail(data.templates, m.value, treatmentId, categoryIds, true);
        return <div key={m.value} className="flex flex-wrap items-center gap-4 py-4"><div className="min-w-[180px] flex-1"><h2 className="font-medium">{m.label_nl}</h2><p className="mt-1 text-xs text-muted-foreground">{resolved?.description}</p></div>{resolved && <><Tag tone={resolved.status === "active" ? "teal" : "warning"}>{options("mail_scope").find((o) => o.value === resolved.scope)?.label_nl}{resolved.status === "draft" ? " (concept)" : ""}</Tag><TextLink onClick={() => setEditing({ template: resolved })}>Bekijk</TextLink></>}</div>;
      })}</div>
      {treatment && <section className="border-t border-line pt-6"><h2 className="mb-4 text-lg font-semibold">Teksten van deze behandeling in de mails</h2><h3 className="mb-2 text-sm font-medium">Voorbereiding, in bevestiging en herinnering</h3><p className="mb-5 whitespace-pre-line text-sm text-muted-foreground">{translated(treatment.preparation_nl, treatment.preparation_en, language) || "—"}</p><h3 className="mb-2 text-sm font-medium">Nazorg, in bedankt en vervolg</h3><p className="mb-5 whitespace-pre-line text-sm text-muted-foreground">{translated(treatment.aftercare_nl, treatment.aftercare_en, language) || "—"}</p><Link to="/organisatie/behandelingen/$id" params={{ id: treatment.id }} className="text-sm text-primary underline">Naar de behandeling</Link><div className="mt-5"><PillButton variant="outline" onClick={() => { const base = resolveMail(data.templates, "confirmation", treatmentId, categoryIds, true); if (base) deviation(base, treatmentId); }}><PlusIcon />Eigen bevestiging voor deze behandeling</PillButton></div></section>}
    </> : <>
      <div className="flex flex-wrap items-end gap-3"><SearchField aria-label="Zoek een sjabloon" placeholder="Zoek een sjabloon" value={query} onChange={(e) => setQuery(e.target.value)} className="w-[300px]" /><Select label="Moment" value={moment} onChange={setMoment} options={[{ value: "all", label: "Alle momenten" }, ...options("mail_moment").map((o) => ({ value: o.value, label: o.label_nl }))]} /><Select label="Categorie" value={category} onChange={setCategory} options={[{ value: "all", label: "Alle categorieën" }, ...org.categories.map((c) => ({ value: c.id, label: c.name_nl }))]} /><Select label="Status" value={status} onChange={setStatus} options={[{ value: "all", label: "Actief en concept" }, ...options("mail_status").map((o) => ({ value: o.value, label: o.label_nl }))]} /></div>
      {options("mail_group").map((group) => {
        const moments = options("mail_moment").filter((o) => o.label_en === group.value).map((o) => o.value);
        const rows = visible.filter((t) => moments.includes(t.moment));
        if (!rows.length) return null;
        return <section key={group.value} className="border-t border-line py-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">{group.label_nl}</h2><PillButton variant="outline" onClick={() => { const base = rows.find((t) => t.scope === "base"); if (base) deviation(base); }}><PlusIcon />Afwijking toevoegen</PillButton></div><div className="flex flex-col gap-2">{rows.filter((t) => t.scope === "base").map((base) => <div key={base.id}>{row(base)}{rows.filter((t) => t.scope !== "base" && t.moment === base.moment).map(row)}</div>)}{rows.filter((t) => t.scope !== "base" && !rows.some((b) => b.scope === "base" && b.moment === t.moment)).map(row)}</div></section>;
      })}
    </>}
    {editing && <MailTemplateModal template={editing.template} defaults={editing.defaults} data={data} org={org} onClose={() => setEditing(null)} />}
  </div>;
}