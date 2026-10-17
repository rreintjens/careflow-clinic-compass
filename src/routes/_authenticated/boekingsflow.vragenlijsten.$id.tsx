import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { PlusIcon, Tag, TextLink, tdCls, thCls } from "@/components/Field";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { opts, optLabel, orgQuery } from "@/data/organisation";
import {
  createDraft, defOf, discardDraft, draftOf, exportFlow, flowOf, linkTreatments, publishVersion, publishedOf, questionnairesQuery, saveDraft, saveFlowDocument, versionsOf, workingVersion,
} from "@/data/questionnaires";
import { makeCtx, type Item, type Page, type QuestionnaireDef } from "@/domain/questionnaire/engine";
import { evaluate } from "@/domain/questionnaire/expr";
import { ComputedModal, ItemModal, PageModal, PublishModal, ThresholdsModal } from "@/features/questionnaire/BuilderModals";
import { conditionText, fieldInfos, refOptions } from "@/features/questionnaire/conditions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/boekingsflow/vragenlijsten/$id")({
  head: () => ({ meta: [{ title: "Vragenlijst bewerken · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(questionnairesQuery), context.queryClient.ensureQueryData(orgQuery)]),
  component: Builder,
});

const ICONS = ["appel", "arts", "auto", "beweging", "blad", "cadeau", "chat", "document", "download", "druppel", "duim-omhoog", "e-mail", "euro", "gebouw", "grafiek", "handen", "hart", "hartslag", "herinnering", "hersenen", "huis", "info", "instellingen", "kaart-chip", "kalender", "klembord", "klok", "koffie", "kruis", "link", "locatie", "meetlint", "min", "mobiel", "oog", "persoon", "pijl-links", "pijl-rechts", "pil", "plus", "route", "schild", "slaap", "slot", "spuit", "ster", "stethoscoop", "tag", "team", "telefoon", "timer", "trofee", "vernieuwen", "videogesprek", "vinkje-cirkel", "vinkje", "vlag", "vlinder", "vraagteken", "waarschuwing", "weegschaal", "zoeken", "zon"];

/** Threshold rows of the design: label + standard / reduced setting paths. */
const THRESHOLDS = [
  { label: "BMI vanaf waar de buikomvang telt", std: "bmi.waist_from", red: "bmi.waist_from_reduced" },
  { label: "BMI vanaf waar direct door", std: "bmi.direct_from", red: "bmi.direct_from_reduced" },
  { label: "Buikomvang man, minimaal", std: "waist_cm.male_min", red: "waist_cm.male_min_reduced", unit: " cm" },
  { label: "Buikomvang vrouw, minimaal", std: "waist_cm.female_min", red: "waist_cm.female_min_reduced", unit: " cm" },
  { label: "BMI onder dit getal: rood", std: "bmi.red_below", red: "bmi.red_below" },
];

type Edit = { kind: "page"; index: number | null } | { kind: "item"; page: number | null; item: number | null } | { kind: "thresholds" } | { kind: "computed"; name: string | null } | { kind: "publish" };

function Builder() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(questionnairesQuery);
  const { data: org } = useSuspenseQuery(orgQuery);
  const qc = useQueryClient();
  const q = data.questionnaires.find((x) => x.id === id);
  const draft = q ? draftOf(data, q.id) : undefined;
  const working = q ? workingVersion(data, q.id) : undefined;
  const def = defOf(working);
  const flow = q ? flowOf(data, q.flow_id) : undefined;
  const doc = (flow?.document ?? {}) as Record<string, unknown>;
  const settings = (doc["settings"] ?? {}) as Record<string, unknown>;
  const computed = (doc["computed_fields"] ?? {}) as Record<string, string>;
  const [edit, setEdit] = useState<Edit | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: questionnairesQuery.queryKey });

  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => { await refresh(); await qc.invalidateQueries({ queryKey: orgQuery.queryKey }); setEdit(null); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Opslaan is niet gelukt"),
  });

  if (!q || !def || !working) return <p className="text-sm">Deze vragenlijst bestaat niet.</p>;
  const editable = !!draft;
  const writeDef = (next: QuestionnaireDef) => {
    if (!draft) { toast.error("Maak eerst een nieuwe versie om te wijzigen"); return; }
    mut.mutate(() => saveDraft(draft.id, next));
  };
  const fields = fieldInfos(def, computed);
  const opsList = opts(org, "questionnaire_op");
  const opsMap = Object.fromEntries(opsList.map((o) => [o.value, o.label]));
  const refs = refOptions(settings, computed);
  const ctx = { fields, ops: opsList, refs };
  const sections = [...new Set(def.pages.map((p) => p.section).filter(Boolean))] as string[];
  const cond = (c: Parameters<typeof conditionText>[0]) => conditionText(c, fields, opsMap, settings);
  const typeLabel = (t: string) => optLabel(org, "questionnaire_item_type", t);
  const pageTypeLabel = (t: string) => optLabel(org, "questionnaire_page_type", t);
  const rejections = Object.keys(def.rejection?.variants ?? {}).map((k) => ({ value: k, label: optLabel(org, "questionnaire_rejection", k) || k }));
  const linked = org.treatments.filter((t) => (q.moment === "after_booking" ? t.post_questionnaire_key : t.pre_questionnaire_key) === q.key);

  const itemSummary = (p: Page, i: Item) => [
    p.section, typeLabel(i.type),
    i.red_if && `rood als ${cond(i.red_if)}`,
    i.signal_if !== undefined && `signaal${i.signal_label ? ` “${i.signal_label}”` : ""}`,
    i.optional && "optioneel",
    i.reuse_in && "hergebruikt bij de gegevens",
    i.prefill_from && "vooraf ingevuld",
    i.note,
  ].filter(Boolean).join(" · ");

  const setPages = (pages: Page[]) => writeDef({ ...def, pages });
  const savePage = (p: Page, index: number | null) => setPages(index === null ? [...def.pages, p] : def.pages.map((x, i) => (i === index ? ({ ...p, ...(x.items ? { items: x.items } : {}) } as Page) : x)));
  const saveItem = (item: Item, section: string | undefined, pageIdx: number | null, itemIdx: number | null) => {
    if (pageIdx === null) {
      setPages([...def.pages, { id: `p_${item.id}`, ...(section ? { section } : {}), items: [item] }]);
      return;
    }
    setPages(def.pages.map((p, i) => {
      if (i !== pageIdx) return p;
      const items = [...(p.items ?? [])];
      if (itemIdx === null) items.push(item); else items[itemIdx] = item;
      return { ...p, ...(section ? { section } : {}), items };
    }));
  };
  const move = (from: number, to: number) => {
    const next = [...def.pages];
    const [m] = next.splice(from, 1);
    if (m) next.splice(to, 0, m);
    setPages(next);
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(exportFlow(data, q.flow_id), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${flow?.key ?? "flow"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  let n = 0;
  const row = (label: string, title: string, sub: string, show: string | null, onEdit: () => void, extra?: { pageIdx?: number }) => {
    n += 1;
    return (
      <div key={`${label}${n}`} draggable={editable && extra?.pageIdx !== undefined}
        onDragStart={() => extra?.pageIdx !== undefined && setDrag(extra.pageIdx)} onDragOver={(e) => e.preventDefault()}
        onDrop={() => { if (drag !== null && extra?.pageIdx !== undefined && drag !== extra.pageIdx) move(drag, extra.pageIdx); setDrag(null); }}
        className="flex items-start gap-3 rounded-[14px] border border-line bg-background px-3 py-3">
        <span className="pt-1 text-muted-foreground" aria-hidden="true">⋮⋮</span>
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sand text-xs">{n}</span>
        <Tag tone={label === "Vraag" ? "teal" : "sand"}>{label}</Tag>
        <div className="min-w-0 flex-1">
          <div className="text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
          {show && <div className="mt-1 text-xs text-primary">↦ Alleen als {show}</div>}
        </div>
        <TextLink onClick={onEdit}>Wijzig</TextLink>
      </div>
    );
  };

  const versions = versionsOf(data, q.id);
  const pub = publishedOf(data, q.id);
  const sample = (f: string) => {
    try {
      const vars: Record<string, unknown> = { weight_kg: 88, height_cm: 178, gewicht: 88, lengte: 178, date_of_birth: "1988-03-14", sex: "Vrouw", origin: ["Geen van deze"] };
      const c = makeCtx({ settings, computed_fields: computed }, vars, new Date().toISOString().slice(0, 10)).computed;
      const v = evaluate(f, { today: new Date().toISOString().slice(0, 10), lookup: (k) => (k.startsWith("settings.") ? k.slice(9).split(".").reduce<unknown>((o, x) => (o as Record<string, unknown>)?.[x], settings) : c[k] ?? vars[k]) });
      return typeof v === "number" ? (Math.round(v * 10) / 10).toString().replace(".", ",") : v === true ? "ja" : v === false ? "nee" : String(v);
    } catch { return "–"; }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/boekingsflow/vragenlijsten" className="text-[13px] text-primary">Vragenlijsten</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">{def.name}</h1>
          <Tag tone={q.moment === "after_booking" ? "sand" : "teal"}>{optLabel(org, "questionnaire_moment", q.moment)}</Tag>
          <Tag tone="sand">{draft ? `Concept, versie ${draft.version_no}` : `${optLabel(org, "questionnaire_status", "published")}, versie ${working.version_no}`}</Tag>
          <div className="ml-auto flex gap-2">
            <Link to="/boekingsflow/vragenlijsten/$id/test" params={{ id: q.id }}><PillButton variant="outline">Testmodus</PillButton></Link>
            <PillButton variant="outline" onClick={download}>Exporteren</PillButton>
            {draft ? (
              <PillButton onClick={() => setEdit({ kind: "publish" })}>Publiceren</PillButton>
            ) : (
              <PillButton onClick={() => mut.mutate(() => createDraft(q.id, working))}>Nieuwe versie maken</PillButton>
            )}
          </div>
        </div>
        {!editable && <p className="mt-2 text-[13px] text-muted-foreground">Dit is de actieve versie; die verandert niet meer. Maak een nieuwe versie om te wijzigen.</p>}
      </div>

      <Card title="Opbouw van de vragenlijst" description="Vragen en pagina’s in de volgorde die de patiënt ziet. Sleep om de volgorde te wijzigen. Een pijl onder een regel betekent: alleen onder een voorwaarde.">
        <div className={cn("flex flex-col gap-2", !editable && "pointer-events-none opacity-90")}>
          {def.pages.map((p, pi) => {
            const items = p.items ?? [];
            if (!items.length) return row("Pagina", p.title ?? "", [pageTypeLabel(p.type ?? "text"), p.body?.slice(0, 80)].filter(Boolean).join(" · "), p.show_if ? cond(p.show_if) : null, () => setEdit({ kind: "page", index: pi }), { pageIdx: pi });
            if (items.length === 1 && !p.title) {
              const i = items[0] as Item;
              return row("Vraag", i.text, itemSummary(p, i), p.show_if ? cond(p.show_if) : i.show_if ? cond(i.show_if) : null, () => setEdit({ kind: "item", page: pi, item: 0 }), { pageIdx: pi });
            }
            return (
              <div key={p.id} draggable={editable} onDragStart={() => setDrag(pi)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== pi) move(drag, pi); setDrag(null); }}
                className="rounded-[16px] border border-dashed border-primary/50 p-3">
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs text-background">{pageTypeLabel("question_page")}</span>
                  <span className="text-sm">{p.title ?? p.section}</span>
                  <span className="ml-auto"><TextLink onClick={() => setEdit({ kind: "page", index: pi })}>Wijzig</TextLink></span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{items.length} vragen op één scherm{p.show_if ? ` · alleen als ${cond(p.show_if)}` : ""}{p.red_if ? ` · rood als ${cond(p.red_if)}` : ""}</p>
                <div className="mt-2 flex flex-col gap-2">
                  {items.map((i, ii) => row("Vraag", i.text, itemSummary(p, i), i.show_if ? cond(i.show_if) : null, () => setEdit({ kind: "item", page: pi, item: ii })))}
                </div>
                {editable && <div className="mt-2"><TextLink onClick={() => setEdit({ kind: "item", page: pi, item: null })}>Vraag aan deze pagina toevoegen</TextLink></div>}
              </div>
            );
          })}
        </div>
        {editable && (
          <div className="mt-4 flex gap-2">
            <PillButton variant="outline" onClick={() => setEdit({ kind: "item", page: null, item: null })}><PlusIcon />Vraag toevoegen</PillButton>
            <PillButton variant="outline" onClick={() => setEdit({ kind: "page", index: null })}><PlusIcon />Pagina toevoegen</PillButton>
          </div>
        )}
      </Card>

      <Card title="Instellingen van deze vragenlijst">
        <div className={cn("grid grid-cols-2 gap-4", !editable && "pointer-events-none opacity-80")}>
          <Select label="Moment" value={def.moment} onChange={(v) => writeDef({ ...def, moment: v })} options={opts(org, "questionnaire_moment")} />
          <MultiSelect label="Gekoppeld aan" value={linked.map((t) => t.id)} onChange={(ids) => mut.mutate(() => linkTreatments(q.key, q.moment, ids, org.treatments))} options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))} />
          {Object.entries((def["outcomes"] ?? {}) as Record<string, string>).map(([k, v]) => (
            <Select key={k} label={k === "red" ? "Bij rood" : k === "green" ? "Bij groen" : "Uitkomst"} value={v} onChange={(x) => writeDef({ ...def, outcomes: { ...(def["outcomes"] as Record<string, string>), [k]: x } })} options={opts(org, "questionnaire_outcome")} />
          ))}
          <Select label="Status" value={draft ? "draft" : "published"} onChange={() => undefined} disabled options={opts(org, "questionnaire_status")} help="Verandert via Publiceren." />
        </div>
      </Card>

      {Object.keys(settings).some((k) => k === "bmi") && (
        <Card title="Grenswaarden" description="Deze waarden gebruikt de BMI-vraag. Ze gelden voor de hele flow en zijn zonder nieuwe versie te wijzigen.">
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className={thCls}>Regel</th><th className={thCls}>Standaard</th><th className={thCls}>Verlaagd, bij herkomst uit de genoemde regio’s</th></tr></thead>
            <tbody className="divide-y divide-line">
              {THRESHOLDS.map((r) => {
                const v = (p: string) => String(p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], settings) ?? "–").replace(".", ",");
                return <tr key={r.label}><td className={tdCls}>{r.label}</td><td className={tdCls}>{v(r.std)}{r.unit ?? ""}</td><td className={tdCls}>{v(r.red)}{r.unit ?? ""}</td></tr>;
              })}
            </tbody>
          </table>
          <div className="mt-4"><PillButton variant="outline" onClick={() => setEdit({ kind: "thresholds" })}>Grenswaarden wijzigen</PillButton></div>
        </Card>
      )}

      <Card title="Berekende velden" description="Eenvoudige formules met velden tussen accolades. Je gebruikt ze in voorwaarden en in teksten.">
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className={thCls}>Veld</th><th className={thCls}>Formule</th><th className={thCls}>Voorbeeld</th><th className={thCls} /></tr></thead>
          <tbody className="divide-y divide-line">
            {Object.entries(computed).map(([k, f]) => (
              <tr key={k}><td className={tdCls}>{k}</td><td className={cn(tdCls, "font-mono text-xs")}>{f}</td><td className={tdCls}>{sample(f)}</td><td className={tdCls}><TextLink onClick={() => setEdit({ kind: "computed", name: k })}>Wijzig</TextLink></td></tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4"><PillButton variant="outline" onClick={() => setEdit({ kind: "computed", name: null })}><PlusIcon />Berekend veld toevoegen</PillButton></div>
      </Card>

      <Card title="Versies">
        <table className="w-full">
          <thead><tr className="border-b border-line"><th className={thCls}>Versie</th><th className={thCls}>Status</th><th className={thCls}>Gepubliceerd</th><th className={thCls}>Notitie</th><th className={thCls} /></tr></thead>
          <tbody className="divide-y divide-line">
            {versions.map((v) => (
              <tr key={v.id}>
                <td className={tdCls}>{v.version_no}</td>
                <td className={tdCls}>{optLabel(org, "questionnaire_status", v.status)}</td>
                <td className={tdCls}>{v.published_at ? new Date(v.published_at).toLocaleDateString("nl-NL") : "–"}</td>
                <td className={tdCls}>{v.note ?? ""}</td>
                <td className={tdCls}>{v.status === "draft" && pub && <TextLink tone="warning" onClick={() => mut.mutate(() => discardDraft(v.id))}>Concept weggooien</TextLink>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {edit?.kind === "page" && (
        <PageModal page={edit.index === null ? null : (def.pages[edit.index] ?? null)} pageTypes={opts(org, "questionnaire_page_type")} sections={sections} icons={ICONS} ctx={ctx}
          onSave={(p) => savePage(p, edit.index)} onClose={() => setEdit(null)}
          onDelete={edit.index === null ? undefined : () => setPages(def.pages.filter((_, i) => i !== edit.index))} />
      )}
      {edit?.kind === "item" && (() => {
        const p = edit.page === null ? undefined : def.pages[edit.page];
        const item = p && edit.item !== null ? (p.items?.[edit.item] ?? null) : null;
        return (
          <ItemModal item={item} itemTypes={opts(org, "questionnaire_item_type")} sections={sections} section={p?.section} rejections={rejections} ctx={ctx}
            onSave={(i, s) => saveItem(i, s, edit.page, edit.item)} onClose={() => setEdit(null)}
            onDelete={edit.page === null || edit.item === null ? undefined : () => {
              const pi = edit.page as number, ii = edit.item as number;
              const pages = def.pages.map((x, i) => (i === pi ? { ...x, items: (x.items ?? []).filter((_, j) => j !== ii) } : x)).filter((x, i) => i !== pi || (x.items?.length ?? 0) > 0 || x.title);
              setPages(pages);
            }} />
        );
      })()}
      {edit?.kind === "thresholds" && flow && (
        <ThresholdsModal settings={settings} rows={THRESHOLDS} onClose={() => setEdit(null)} onSave={(s) => mut.mutate(() => saveFlowDocument(flow.id, { ...doc, settings: s }))} />
      )}
      {edit?.kind === "computed" && flow && (
        <ComputedModal name={edit.name} formula={edit.name ? (computed[edit.name] ?? "") : ""} sample={sample} onClose={() => setEdit(null)}
          onSave={(name, f) => mut.mutate(() => saveFlowDocument(flow.id, { ...doc, computed_fields: { ...computed, [name]: f } }))}
          onDelete={edit.name ? () => { const c = { ...computed }; delete c[edit.name as string]; mut.mutate(() => saveFlowDocument(flow.id, { ...doc, computed_fields: c })); } : undefined} />
      )}
      {edit?.kind === "publish" && draft && (
        <PublishModal versionNo={draft.version_no} busy={mut.isPending} changes={pub ? `Versie ${pub.version_no} is nu actief.` : "Er is nog geen actieve versie."} onClose={() => setEdit(null)}
          onPublish={() => mut.mutate(async () => { await publishVersion(q.id, draft.id); toast.success(`Versie ${draft.version_no} is gepubliceerd`); })} />
      )}
    </div>
  );
}
