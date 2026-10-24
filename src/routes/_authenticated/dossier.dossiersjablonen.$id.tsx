import { useMutation, useQueryClient, useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { TextArea, TextField, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { UiIcon } from "@/components/UiIcon";
import { categoryLabel, conceptOf, createConcept, dossierOptionsQuery, libraryQuery, liveOf, optsOf, publishTemplate, saveConcept, templatesQuery, useAsConcept, type TemplateVersionRow } from "@/data/dossier";
import { SECTION_KEYS, type SectionKey, type TemplateContent } from "@/domain/dossier-templates";
import { VersionPill } from "@/features/questionnaire/VersionPill";
import { supabase } from "@/integrations/supabase/client";

const TITLE = "Dossiersjabloon · The Body Clinic";
const DESC = "Consultstappen, vragen en nazorg van een dossiersjabloon.";
export const Route = createFileRoute("/_authenticated/dossier/dossiersjablonen/$id")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(templatesQuery), context.queryClient.ensureQueryData(libraryQuery), context.queryClient.ensureQueryData(dossierOptionsQuery)]),
  component: TemplateEditor,
});

const SECTION_TITLES: Record<SectionKey, { title: string; help: string }> = {
  anamnese: { title: "Anamnesevragen", help: "Onder SOEP in de stap Anamnese." },
  fiscaal: { title: "Fiscale vragen", help: "Alleen als de behandeling btw-vrijstelling toelaat." },
  bespreekpunt: { title: "Bespreekpunten", help: "Elk punt is verplicht ja of nee." },
  controle: { title: "Controlevragen", help: "Tijdens of na de behandeling." },
};
const time = (d: string) => new Date(d).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" });
const date = (d: string | null) => (d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" }) : "");

function TemplateEditor() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(templatesQuery);
  const { data: library } = useSuspenseQuery(libraryQuery);
  const { data: optRows } = useSuspenseQuery(dossierOptionsQuery);
  const { data: questionnaires = [] } = useQuery({ queryKey: ["questionnaire-keys"], queryFn: async () => (await supabase.from("questionnaires").select("key, name").order("name")).data ?? [] });
  const qc = useQueryClient();
  const t = data.templates.find((x) => x.id === id);
  const live = liveOf(data.versions, id); const concept = conceptOf(data.versions, id);
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [dialog, setDialog] = useState<"publish" | "versions" | null>(null);
  const shownVersion: TemplateVersionRow | undefined = viewId ? data.versions.find((v) => v.id === viewId) : editing ? concept : live ?? concept;
  const editable = editing && shownVersion?.status === "concept";
  const [c, setC] = useState<TemplateContent | undefined>(shownVersion?.content);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  useEffect(() => { setC(shownVersion?.content); }, [shownVersion?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refresh = () => qc.invalidateQueries({ queryKey: templatesQuery.queryKey });
  const write = (next: TemplateContent) => {
    setC(next);
    if (!concept) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { saveConcept(concept.id, next).then(() => setSavedAt(new Date().toISOString())).catch((e: Error) => toast.error(e.message)); }, 500);
  };
  const mut = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: refresh, onError: (e) => toast.error(e.message) });
  if (!t || !c || !shownVersion) return <p className="text-sm text-muted-foreground">Sjabloon niet gevonden.</p>;

  const lib = (code: string) => library.find((q) => q.code === code);
  const steps = optsOf(optRows, "dossier_step");
  const stepLabel = (v: string) => steps.find((s) => s.value === v)?.label ?? v;
  const groupLabel = (g: string) => optsOf(optRows, "library_question_group").find((o) => o.value === g)?.label ?? g;
  const libraryOptions = (k: SectionKey) => library.map((q) => ({ value: q.code, label: `${q.code} · ${q.text_nl}`, group: groupLabel(q.grp), keywords: q.code })).sort((a, b) => (a.group === groupLabel(k) ? -1 : 0) - (b.group === groupLabel(k) ? -1 : 0));
  const startEdit = () => { setViewId(null); if (concept) { setEditing(true); return; } if (live) mut.mutate(async () => { const n = await createConcept(id, live, data.versions); setEditing(true); toast.success(`Je werkt nu aan versie ${n}. Versie ${live.version} blijft live tot je publiceert.`); }); };
  const all = data.versions.filter((v) => v.template_id === id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/dossier/dossiersjablonen" className="text-[13px] text-primary">Dossiersjablonen</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">{t.name}</h1>
          <VersionPill tone={shownVersion.status === "live" ? "live" : shownVersion.status === "concept" ? "draft" : "archive"}>{shownVersion.status === "live" ? `Versie ${shownVersion.version} live` : shownVersion.status === "concept" ? `Concept versie ${shownVersion.version}` : `Gearchiveerde versie ${shownVersion.version}`}</VersionPill>
          <div className="ml-auto flex gap-2">
            <PillButton variant="outline" onClick={() => setDialog("versions")}>Versies</PillButton>
            {editable ? <PillButton onClick={() => setDialog("publish")}>Publiceren</PillButton> : !viewId && <PillButton onClick={startEdit}>Aanpassen</PillButton>}
          </div>
        </div>
        <p className="mt-1 text-[15px] text-muted-foreground">{categoryLabel(data.categories, t.category_id)}</p>
      </div>
      {editable ? <p className="text-[13px] text-muted-foreground">Alles wordt direct bewaard{savedAt ? ` · ${time(savedAt)}` : ""}</p>
        : <p className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm"><UiIcon name="slot" className="size-4 shrink-0" />{viewId ? `Je bekijkt versie ${shownVersion.version}. ` : "Je bekijkt de versie die live staat. "}Klik op Aanpassen om een concept te maken; lopende consulten houden de versie waarmee ze begonnen.</p>}
      {!editing && concept && live && !viewId && <div className="flex items-center gap-4 rounded-[16px] bg-warning-bg px-5 py-4 text-sm"><span className="mr-auto font-semibold text-warning">Er ligt een concept: versie {concept.version}{concept.change_note ? ` · ${concept.change_note}` : ""}</span><PillButton onClick={startEdit}>Verder met versie {concept.version}</PillButton></div>}

      <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-6">
          <Card title="Consultstappen" description="De volgorde waarin de arts de stappen krijgt.">
            <MultiSelect label="Stappen" value={c.steps} onChange={(v) => write({ ...c, steps: v })} options={steps} />
          </Card>
          <Card title="Medische vragenlijst">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select label="Vragenlijst" value={c.questionnaire.key ?? ""} onChange={(v) => write({ ...c, questionnaire: { ...c.questionnaire, key: v || null } })} options={[{ value: "", label: "Geen vragenlijst" }, ...questionnaires.map((q) => ({ value: q.key, label: q.name }))]} />
              <Select label="Opnieuw vragen" value={String(c.questionnaire.reaskDays)} onChange={(v) => write({ ...c, questionnaire: { ...c.questionnaire, reaskDays: Number(v) } })} options={optsOf(optRows, "reask_days")} />
            </div>
          </Card>
          {SECTION_KEYS.map((k) => (
            <Card key={k} title={SECTION_TITLES[k].title} description={SECTION_TITLES[k].help}>
              <div className="flex flex-col gap-2">
                {c[k].map((code, i) => (
                  <div key={code} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{code}</span><span className="flex-1">{lib(code)?.text_nl ?? "Onbekende vraag"}</span>
                    {editable && <>
                      <button type="button" aria-label="Omhoog" disabled={i === 0} onClick={() => { const a = [...c[k]]; [a[i - 1], a[i]] = [a[i]!, a[i - 1]!]; write({ ...c, [k]: a }); }} className="text-primary disabled:opacity-30">↑</button>
                      <TextLink onClick={() => write({ ...c, [k]: c[k].filter((x) => x !== code) })}>Verwijder</TextLink>
                    </>}
                  </div>
                ))}
                {editable && <MultiSelect label="+ Uit bibliotheek" value={c[k]} onChange={(v) => write({ ...c, [k]: v })} options={libraryOptions(k)} />}
                {!c[k].length && !editable && <p className="text-sm text-muted-foreground">Geen vragen.</p>}
              </div>
            </Card>
          ))}
          <Card title="Diagnoses en toestemming">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField label="Voorgeselecteerde diagnosecodes" help="Gescheiden door komma's, bijvoorbeeld E66.0" value={c.diagnoses.join(", ")} onChange={(e) => write({ ...c, diagnoses: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
              <Select label="Toestemming opnieuw tekenen" value={String(c.resignMonths)} onChange={(v) => write({ ...c, resignMonths: Number(v) })} options={optsOf(optRows, "resign_months")} />
            </div>
          </Card>
          <Card title="Voor de patiënt" description="Komt na het consult in Mijn omgeving.">
            <div className="flex flex-col gap-4">
              <TextArea label="Nazorg" rows={4} value={c.aftercare} onChange={(e) => write({ ...c, aftercare: e.target.value })} />
              <TextArea label="Notitie voor de patiënt (vooraf ingevuld)" rows={3} value={c.patientNote} onChange={(e) => write({ ...c, patientNote: e.target.value })} />
              <Select label="Standaard behandelherinnering" value={String(c.reminderDays)} onChange={(v) => write({ ...c, reminderDays: Number(v) })} options={optsOf(optRows, "reminder_days")} />
            </div>
          </Card>
        </fieldset>

        <Card tone="sand" title="Zo krijgt de arts het" className="sticky top-6">
          <ol className="flex flex-col gap-3 text-sm">
            {c.steps.map((s, i) => (
              <li key={s}>
                <span className="font-medium">{i + 1}. {stepLabel(s)}</span>
                <ul className="mt-1 flex flex-col gap-0.5 pl-4 text-muted-foreground">
                  {s === "medische_status" && <li>{questionnaires.find((q) => q.key === c.questionnaire.key)?.name ?? "Geen vragenlijst"}</li>}
                  {s === "anamnese" && <li>SOEP</li>}
                  {s === "anamnese" && c.anamnese.map((x) => <li key={x}>{lib(x)?.text_nl}</li>)}
                  {s === "diagnose" && <>{c.diagnoses.map((x) => <li key={x}>Diagnose {x}</li>)}{c.bespreekpunt.map((x) => <li key={x}>Besproken: {lib(x)?.text_nl}</li>)}{c.fiscaal.length > 0 && <li>Btw-vrijstelling ({c.fiscaal.length} vragen)</li>}</>}
                  {s === "behandeling" && c.controle.map((x) => <li key={x}>{lib(x)?.text_nl}</li>)}
                  {s === "afronden" && <><li>Nazorg naar Mijn omgeving</li>{c.reminderDays > 0 && <li>Herinnering na {c.reminderDays} dagen</li>}</>}
                </ul>
              </li>
            ))}
            {!c.steps.length && <li className="text-muted-foreground">Nog geen stappen.</li>}
          </ol>
        </Card>
      </div>

      {dialog === "publish" && concept && (
        <Modal open title={`Versie ${concept.version} publiceren`} onOpenChange={(o) => !o && setDialog(null)}
          footer={<><PillButton variant="outline" onClick={() => setDialog(null)}>Annuleren</PillButton><PillButton onClick={() => mut.mutate(async () => { clearTimeout(timer.current); await saveConcept(concept.id, c); await publishTemplate(id, concept.id); setEditing(false); setDialog(null); toast.success(`Versie ${concept.version} staat live`); })}>Publiceren</PillButton></>}>
          <p className="text-sm">{live ? `Versie ${live.version} wordt vervangen door versie ${concept.version}.` : `Versie ${concept.version} wordt de eerste live versie.`} Consulten die al lopen houden hun versie.</p>
        </Modal>
      )}
      {dialog === "versions" && (
        <Modal open width="lg" title="Versies" onOpenChange={(o) => !o && setDialog(null)} footer={<PillButton variant="outline" onClick={() => setDialog(null)}>Sluiten</PillButton>}>
          <div className="flex flex-col gap-2">
            {all.map((v) => (
              <div key={v.id} className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm">
                <span className="font-medium">Versie {v.version}</span>
                <VersionPill tone={v.status === "live" ? "live" : v.status === "concept" ? "draft" : "archive"}>{v.status === "live" ? "Live" : v.status === "concept" ? "Concept" : "Archief"}</VersionPill>
                <span className="flex-1 text-muted-foreground">{v.published_at ? `Gepubliceerd ${date(v.published_at)}` : v.change_note ?? ""}</span>
                <TextLink onClick={() => { setEditing(v.status === "concept"); setViewId(v.status === "concept" ? null : v.id); setDialog(null); }}>Bekijk</TextLink>
                {v.status === "archived" && <TextLink onClick={() => mut.mutate(async () => { await useAsConcept(v, concept, data.versions); setViewId(null); setEditing(true); setDialog(null); })}>Als concept gebruiken</TextLink>}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
