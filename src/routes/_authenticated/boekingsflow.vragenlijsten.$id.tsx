import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { rowOpen, RowChevron } from "@/components/ListPage";
import { PlusIcon, Tag, TextLink, tdCls, thCls } from "@/components/Field";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { opts, optLabel, orgQuery } from "@/data/organisation";
import {
  createDraft, defOf, discardDraft, draftOf, exportFlow, flowOf, importFlow, linkTreatments, publishVersion, publishedOf, questionnairesQuery, saveDraft, saveFlowDocument, staffNamesQuery, useVersionAsDraft, versionsOf, type VersionRow,
} from "@/data/questionnaires";
import { effectiveVisibility, questionNumbers, readFieldNames } from "@/domain/questionnaire/builder";
import { describeChanges, insertBeforeLast, rowChange } from "@/domain/questionnaire/diff";
import { makeCtx, type FlowFile, type Item, type ItemType, type Page, type PageType, type QuestionnaireDef } from "@/domain/questionnaire/engine";
import { evaluate } from "@/domain/questionnaire/expr";
import { configurationChanges, versionConfig } from "@/domain/questionnaire/version-config";
import { AddList, type AddChoice } from "@/features/questionnaire/AddChooser";
import { libraryItem } from "@/domain/dossier-templates";
import { libraryQuery } from "@/data/dossier";
import { DiscardDialog, PublishDialog, VersionsDialog, changesCount, livePeriod, longDate, whenSaved } from "@/features/questionnaire/VersionDialogs";
import { VersionPill } from "@/features/questionnaire/VersionPill";
import { BoodschapModal, START, flowPositions } from "@/features/questionnaire/BoodschapModal";
import { ComputedModal, ItemModal, PageModal, ThresholdsModal, type IconEntry } from "@/features/questionnaire/BuilderModals";
import { compactConditionText, conditionText, fieldInfos, refOptions } from "@/features/questionnaire/conditions";
import { QuestionnaireRunner } from "@/features/questionnaire/QuestionnaireRunner";
import { UiIcon } from "@/components/UiIcon";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/boekingsflow/vragenlijsten/$id")({
  head: () => ({ meta: [{ title: "Vragenlijst bewerken · Beheer · The Body Clinic" }, { name: "description", content: "Vragen, voorwaarden en grenswaarden beheren voor The Body Clinic." }, { property: "og:title", content: "Vragenlijst bewerken · The Body Clinic" }, { property: "og:description", content: "Vragen, voorwaarden en grenswaarden beheren voor The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(questionnairesQuery), context.queryClient.ensureQueryData(orgQuery)]),
  component: Builder,
});

const iconsQuery = { queryKey: ["ui-icons"], queryFn: async (): Promise<IconEntry[]> => (await fetch("/ui-icons/icons.json")).json(), staleTime: Infinity };

/** Threshold rows of the design: label + standard / reduced setting paths. */
const THRESHOLDS = [
  { label: "BMI vanaf waar de buikomvang telt", std: "bmi.waist_from", red: "bmi.waist_from_reduced" },
  { label: "BMI vanaf waar direct door", std: "bmi.direct_from", red: "bmi.direct_from_reduced" },
  { label: "Buikomvang man, minimaal", std: "waist_cm.male_min", red: "waist_cm.male_min_reduced", unit: " cm" },
  { label: "Buikomvang vrouw, minimaal", std: "waist_cm.female_min", red: "waist_cm.female_min_reduced", unit: " cm" },
  { label: "BMI onder dit getal: rood", std: "bmi.red_below", red: "bmi.red_below" },
];

type Edit = { kind: "versions" } | { kind: "discard" } | { kind: "page"; index: number | null; type?: PageType } | { kind: "boodschap"; index: number | null } | { kind: "item"; page: number | null; item: number | null; type?: ItemType } | { kind: "thresholds" } | { kind: "computed"; name: string | null } | { kind: "publish" };

function Builder() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(questionnairesQuery);
  const { data: org } = useSuspenseQuery(orgQuery);
  const qc = useQueryClient();
  const q = data.questionnaires.find((x) => x.id === id);
  const draft = q ? draftOf(data, q.id) : undefined;
  const pub = q ? publishedOf(data, q.id) : undefined;
  const versions = q ? versionsOf(data, q.id) : [];
  const [editing, setEditing] = useState(false);
  const { data: library = [] } = useQuery(libraryQuery);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const archived = versions.find((v) => v.id === archiveId && v.status === "archived");
  // Without a live version the concept is the only thing to work on.
  const inEdit = !!draft && !archived && (editing || !pub);
  const working = archived ?? (inEdit ? draft : pub ?? draft);
  const def = defOf(working);
  const flow = q ? flowOf(data, q.flow_id) : undefined;
  const doc = versionConfig(working?.version_config) as unknown as Record<string, unknown>;
  const names = readFieldNames(doc);
  const settings = (doc["settings"] ?? {}) as Record<string, unknown>;
  const computed = (doc["computed_fields"] ?? {}) as Record<string, string>;
  const [edit, setEdit] = useState<Edit | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const [itemDrag, setItemDrag] = useState<{ page: number; idx: number } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<number | null>(0);
  const nameIds = [...new Set(versions.flatMap((v) => [v.published_by, v.updated_by]).filter((x): x is string => !!x))];
  const { data: names_ = {} } = useQuery(staffNamesQuery(nameIds));
  useEffect(() => { if (!draft) setEditing(false); }, [draft]);
  const { data: icons = [] } = useQuery(iconsQuery);
  const counts = useQuery({
    queryKey: ["answer-counts", id], enabled: edit?.kind === "publish",
    queryFn: async () => {
      const ids = (q ? versionsOf(data, q.id) : []).map((v) => v.id);
      const { data: rows } = await supabase.from("answer_sets").select("version_id, status").in("version_id", ids);
      const out: Record<string, { all: number; open: number }> = {};
      for (const r of rows ?? []) { if (!r.version_id) continue; const c = (out[r.version_id] ??= { all: 0, open: 0 }); c.all += 1; if (r.status !== "completed") c.open += 1; }
      return out;
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: questionnairesQuery.queryKey });

  const mut = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: async () => { await refresh(); await qc.invalidateQueries({ queryKey: orgQuery.queryKey }); setEdit((e) => (e?.kind === "versions" ? e : null)); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Opslaan is niet gelukt"),
  });

  if (!q || !def || !working) return <p className="text-sm">Deze vragenlijst bestaat niet.</p>;
  const editable = inEdit;
  const writeDef = (next: QuestionnaireDef) => {
    if (!draft || !inEdit) { toast.error("Klik eerst op Aanpassen om te wijzigen"); return; }
    mut.mutate(() => saveDraft(draft.id, next));
  };
  const fields = fieldInfos(def, computed, names);
  const opsList = opts(org, "questionnaire_op");
  const opsMap = Object.fromEntries(opsList.map((o) => [o.value, o.label]));
  const refs = refOptions(settings, computed, names);
  const ctx = { fields, ops: opsList, refs, settings, computed, names };
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
  /** New rows land after the selected row ("Komt na de geselecteerde regel"), else at the end. */
  const insertAt = sel === null ? def.pages.length : sel + 1;
  const insert = (p: Page) => { const next = [...def.pages]; next.splice(insertAt, 0, p); setSel(insertAt); return next; };
  const savePage = (p: Page, index: number | null) => setPages(index === null ? insert(p) : def.pages.map((x, i) => (i === index ? ({ ...p, ...(x.items ? { items: x.items } : {}) } as Page) : x)));
  const saveBoodschap = (p: Page, index: number | null, after: string) => {
    const rest = def.pages.filter((_, i) => i !== index);
    const at = after === START ? 0 : rest.findIndex((x) => x.id === after) + 1;
    rest.splice(at < 0 ? rest.length : at, 0, p);
    setPages(rest);
  };
  const saveItem = (item: Item, section: string | undefined, pageIdx: number | null, itemIdx: number | null, pageCondition?: { value: Page["show_if"] }) => {
    if (pageIdx === null) {
      setPages(insert({ id: `p_${item.id}`, ...(section ? { section } : {}), items: [item] }));
      return;
    }
    setPages(def.pages.map((p, i) => {
      if (i !== pageIdx) return p;
      const items = [...(p.items ?? [])];
      if (itemIdx === null) items.push(item); else items[itemIdx] = item;
      const next = { ...p, ...(section ? { section } : {}), items };
      if (pageCondition) { if (pageCondition.value) next.show_if = pageCondition.value; else delete next.show_if; }
      return next;
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

  const moveItem = (page: number, from: number, to: number) => setPages(def.pages.map((p, i) => {
    if (i !== page) return p;
    const items = [...(p.items ?? [])];
    const [m] = items.splice(from, 1);
    if (m) items.splice(to, 0, m);
    return { ...p, items };
  }));
  const toggleGroup = (id: string) => setCollapsed((c) => { const x = new Set(c); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  let n = 0;
  const row = (label: string, title: string, sub: string, show: string | null, onEdit: () => void, extra?: { pageIdx?: number; item?: { page: number; idx: number }; badge?: React.ReactNode; linked?: boolean }) => {
    n += 1;
    const it = extra?.item;
    const selIdx = extra?.pageIdx ?? it?.page;
    return (
      <div key={`${label}${n}`} draggable={editable && (extra?.pageIdx !== undefined || !!it)}
        onDragStart={(e) => { e.stopPropagation(); if (it) setItemDrag(it); else if (extra?.pageIdx !== undefined) setDrag(extra.pageIdx); }} onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          if (it && itemDrag) { e.stopPropagation(); if (itemDrag.page === it.page && itemDrag.idx !== it.idx) moveItem(it.page, itemDrag.idx, it.idx); setItemDrag(null); return; }
          if (drag !== null && extra?.pageIdx !== undefined && drag !== extra.pageIdx) move(drag, extra.pageIdx); setDrag(null);
        }}
        onClick={() => { if (selIdx !== undefined) setSel(selIdx); }}
        className={cn("flex items-start gap-3 rounded-[14px] border bg-background px-3 py-3", extra?.pageIdx !== undefined && sel === extra.pageIdx ? "border-primary" : "border-line")}>
        {editable && <span className="cursor-grab pt-1 text-muted-foreground" aria-hidden="true">⋮⋮</span>}
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-sand text-xs">{n}</span>
        <Tag tone={label === "Vraag" ? "teal" : "sand"}>{label}</Tag>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">{extra?.linked && <UiIcon name="link" className="size-3.5 shrink-0 text-primary" aria-label="Uit de bibliotheek" />}{title}{extra?.badge}</div>
          <div className="text-xs text-muted-foreground">{sub}</div>
          {show && <div className="mt-1 flex items-center gap-1.5 text-xs text-primary"><UiIcon name="route" className="size-3.5" />Alleen als {show}</div>}
        </div>
        {editable && <button type="button" aria-label="Wijzig" onClick={(e) => { e.stopPropagation(); onEdit(); }} className="shrink-0 self-center text-primary"><RowChevron /></button>}
      </div>
    );
  };
  const short = (c: Parameters<typeof compactConditionText>[0]) => compactConditionText(c, ctx);

  const sample = (f: string) => {
    try {
      const vars: Record<string, unknown> = { weight_kg: 88, height_cm: 178, gewicht: 88, lengte: 178, date_of_birth: "1988-03-14", sex: "Vrouw", origin: ["Geen van deze"] };
      const c = makeCtx({ settings, computed_fields: computed }, vars, new Date().toISOString().slice(0, 10)).computed;
      const v = evaluate(f, { today: new Date().toISOString().slice(0, 10), lookup: (k) => (k.startsWith("settings.") ? k.slice(9).split(".").reduce<unknown>((o, x) => (o as Record<string, unknown>)?.[x], settings) : c[k] ?? vars[k]) });
      return typeof v === "number" ? (Math.round(v * 10) / 10).toString().replace(".", ",") : v === true ? "ja" : v === false ? "nee" : String(v);
    } catch { return "–"; }
  };

  const today = new Date().toISOString().slice(0, 10);
  const liveDef = defOf(pub);
  const changes = draft && pub ? describeChanges(liveDef, defOf(draft) as QuestionnaireDef) : [];
  const nums = questionNumbers(def);
  const selPage = sel !== null ? def.pages[sel] : undefined;
  const previewLabel = selPage ? (selPage.items?.length === 1 && !selPage.title ? `Vraag ${nums[selPage.items[0]!.id] ?? ""} · ${selPage.items[0]!.text}` : `Pagina ${nums[selPage.id] ?? sel! + 1} · ${selPage.title ?? selPage.section ?? ""}`) : "";
  const startEdit = () => {
    setArchiveId(null); setNotice(null);
    if (draft) { setEditing(true); return; }
    if (!pub) return;
    mut.mutate(async () => { await createDraft(q.id, pub); setEditing(true); setNotice(`Je werkt nu aan versie ${Math.max(...versions.map((v) => v.version_no)) + 1}. Versie ${pub.version_no} blijft live tot je publiceert.`); });
  };
  const blank = (c: AddChoice): Page => {
    const uid = Date.now().toString(36);
    if (c.kind === "library") return { id: `p_q_${uid}`, items: [libraryItem(c.question, `q_${uid}`)] };
    if (c.kind === "item") return { id: `p_q_${uid}`, items: [{ id: `q_${uid}`, type: c.type, text: "Nieuwe vraag", ...(c.type === "single_choice" || c.type === "multi_choice" ? { options: [] } : {}) }] };
    return { id: `p_${uid}`, type: c.type, title: c.type === "question_page" ? "Nieuwe vragenpagina" : "Nieuwe pagina", ...(c.type === "question_page" ? { items: [] } : {}) };
  };
  const addRow = (c: AddChoice) => {
    const r = insertBeforeLast(def.pages, blank(c));
    setAdding(false); setSel(r.index); writeDef({ ...def, pages: r.pages });
  };
  const badge = (p: Page, item?: { id: string }) => {
    if (!inEdit) return null;
    const k = rowChange(liveDef, p, item);
    return k ? <VersionPill tone="draft">{k === "new" ? "Nieuw" : "Gewijzigd"}</VersionPill> : null;
  };
  const by = (uid: string | null | undefined) => (uid && names_[uid] ? names_[uid] : "");
  const testLink = (v: VersionRow | undefined, label: string, variant: "outline" | "link" = "outline") => (
    <Link to="/boekingsflow/vragenlijsten/$id/test" params={{ id: q.id }} search={v ? { versie: v.id } : {}} target="_blank">{variant === "link" ? <span className="text-sm text-primary underline">{label}</span> : <PillButton variant="outline">{label}</PillButton>}</Link>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/boekingsflow/vragenlijsten" className="text-[13px] text-primary">Vragenlijsten</Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">{def.name}</h1>
          <Tag tone={q.moment === "after_booking" ? "sand" : "teal"}>{optLabel(org, "questionnaire_moment", q.moment)}</Tag>
          {archived ? <VersionPill tone="archive">Archief · versie {archived.version_no}</VersionPill>
            : inEdit && draft ? <VersionPill tone="draft">Concept · versie {draft.version_no}, nog niet live</VersionPill>
            : pub ? <VersionPill tone="live">Live · versie {pub.version_no}</VersionPill> : null}
          <div className="ml-auto flex gap-2">
            {!inEdit && !archived && testLink(pub, "Test als patiënt")}
            <PillButton variant="outline" onClick={() => setEdit({ kind: "versions" })}><UiIcon name="klok" className="size-4" />Versies</PillButton>
            {!inEdit && !archived && pub && !draft && <PillButton onClick={startEdit} disabled={mut.isPending}>Aanpassen</PillButton>}
          </div>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {[archived ? "" : inEdit && draft ? (pub ? `Gebaseerd op versie ${pub.version_no}` : "Nog geen versie live") : pub ? `Live sinds ${longDate(pub.published_at)}${by(pub.published_by) ? `, gepubliceerd door ${by(pub.published_by)}` : ""}` : "",
            linked.length ? `gekoppeld aan ${linked.map((t) => t.name_nl).join(", ")}` : "", `${def.pages.length} pagina’s`].filter(Boolean).join(" · ")}
        </p>
      </div>

      {archived && (() => { const per = livePeriod(archived, versions); return (
        <div className="flex flex-wrap items-center gap-4 rounded-[16px] bg-sand px-5 py-4">
          <p className="min-w-0 flex-1 text-sm"><b className="font-semibold">Je bekijkt versie {archived.version_no} · archief</b>{per.from ? `, live van ${per.from}${per.to ? ` tot ${per.to}` : ""}` : ""}. Niets kan hier worden gewijzigd.</p>
          {pub && <PillButton variant="outline" onClick={() => setArchiveId(null)}>Terug naar versie {pub.version_no} (live)</PillButton>}
          <PillButton onClick={() => { if (draft && !window.confirm(`Concept versie ${draft.version_no} wordt vervangen door een kopie van versie ${archived.version_no}. Doorgaan?`)) return; mut.mutate(async () => { await useVersionAsDraft(q.id, archived, draft); setArchiveId(null); setEditing(true); toast.success(`Versie ${archived.version_no} staat klaar als concept`); }); }}>Als concept gebruiken</PillButton>
        </div>); })()}

      {inEdit && draft && (
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-4 rounded-[16px] bg-warning-bg px-5 py-4 ring-1 ring-warning/30">
          <div className="min-w-[280px] flex-1 text-sm">
            <p className="font-semibold text-warning">Je werkt aan versie {draft.version_no} · concept</p>
            <p>{pub ? `Versie ${pub.version_no} blijft live voor patiënten tot je publiceert. ` : ""}Alles wat je wijzigt wordt meteen bewaard · {changesCount(changes.length)}{mut.isPending ? " · bezig met bewaren…" : ""}.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
          {pub && <TextLink tone="warning" onClick={() => setEdit({ kind: "discard" })}>Concept weggooien</TextLink>}
          {testLink(draft, "Test concept")}
          {pub && <PillButton variant="outline" onClick={() => { setEditing(false); setNotice(`Versie ${draft.version_no} is bewaard als concept. Je kunt later verder.`); }}>Opslaan en sluiten</PillButton>}
          <PillButton onClick={() => setEdit({ kind: "publish" })}>Publiceren</PillButton>
          </div>
        </div>
      )}

      {!inEdit && !archived && draft && pub && (
        <div className="flex flex-wrap items-center gap-4 rounded-[16px] bg-warning-bg px-5 py-4 ring-1 ring-warning/30">
          <div className="mr-auto text-sm">
            <p className="font-semibold text-warning">Er ligt een concept: versie {draft.version_no}</p>
            <p>Laatst bewaard {whenSaved(draft.updated_at)}{by(draft.updated_by) ? ` door ${by(draft.updated_by)}` : ""} · {changesCount(changes.length)} ten opzichte van versie {pub.version_no}. Versie {pub.version_no} staat nog live.</p>
          </div>
          <TextLink tone="warning" onClick={() => setEdit({ kind: "discard" })}>Concept weggooien</TextLink>
          <PillButton onClick={startEdit}>Verder met versie {draft.version_no}</PillButton>
        </div>
      )}

      {!inEdit && !archived && pub && !draft && (
        <p className="flex items-center gap-3 rounded-[14px] bg-sand px-4 py-3 text-sm"><UiIcon name="slot" className="size-4 shrink-0" />Je bekijkt de versie die live staat. Niets kan hier worden gewijzigd of versleept. Klik op Aanpassen om versie {Math.max(0, ...versions.map((v) => v.version_no)) + 1} te maken; versie {pub.version_no} blijft live tot je publiceert.</p>
      )}

      {notice && <p className="flex items-center gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-sm text-primary-hover"><UiIcon name="vinkje" className="size-4 shrink-0" /><span className="mr-auto">{notice}</span><button type="button" aria-label="Sluiten" onClick={() => setNotice(null)}><UiIcon name="kruis" className="size-4" /></button></p>}

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
      <div className="flex min-w-0 flex-col gap-6">
      <Card title="Opbouw van de vragenlijst" description="Klik op een regel om rechts te zien hoe de patiënt hem ziet." action={<span className="text-[13px] text-muted-foreground">{editable ? "Sleep om de volgorde te wijzigen" : "Alleen-lezen"}</span>}>
        <div className="flex flex-col gap-2">
          {def.pages.map((p, pi) => {
            const items = p.items ?? [];
            if (!items.length) return row("Pagina", p.title ?? "", [pageTypeLabel(p.type ?? "text"), p.body?.slice(0, 80)].filter(Boolean).join(" · "), p.show_if ? short(p.show_if) : null, () => setEdit(p.type === "boodschap" ? { kind: "boodschap", index: pi } : { kind: "page", index: pi }), { pageIdx: pi, badge: badge(p) });
            if (items.length === 1 && !p.title) {
              const i = items[0] as Item;
              return row("Vraag", i.text, itemSummary(p, i), effectiveVisibility(p, i) ? short(effectiveVisibility(p, i)) : null, () => setEdit({ kind: "item", page: pi, item: 0 }), { pageIdx: pi, badge: badge(p, i), linked: !!i["library_code"] });
            }
            return (
              <div key={p.id} draggable={editable} onDragStart={() => setDrag(pi)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag !== null && drag !== pi) move(drag, pi); setDrag(null); }}
                onClick={() => setSel(pi)} className={cn("rounded-[16px] border border-dashed p-3", sel === pi ? "border-primary" : "border-primary/50")}>
                <div className="flex items-center gap-3">
                  {editable && <span className="cursor-grab text-muted-foreground" aria-hidden="true">⋮⋮</span>}
                  <button type="button" onClick={() => toggleGroup(p.id)} aria-expanded={!collapsed.has(p.id)} aria-label={collapsed.has(p.id) ? "Uitklappen" : "Inklappen"} className="flex size-7 items-center justify-center rounded-full hover:bg-sand">
                    <img src="/ui-icons/pijl-rechts.svg" alt="" className={cn("size-4 transition-transform", !collapsed.has(p.id) && "rotate-90")} />
                  </button>
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs text-background">{pageTypeLabel("question_page")}</span>
                  <span className="text-sm">{p.title ?? p.section}</span>{badge(p)}
                  {editable && <button type="button" aria-label="Wijzig" onClick={(e) => { e.stopPropagation(); setEdit({ kind: "page", index: pi }); }} className="ml-auto shrink-0 text-primary"><RowChevron /></button>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{items.length} vragen op één scherm{p.show_if ? ` · alleen als ${short(p.show_if)}` : ""}{p.red_if ? ` · rood als ${cond(p.red_if)}` : ""}</p>
                {!collapsed.has(p.id) && <div className="mt-2 flex flex-col gap-2">
                  {items.map((i, ii) => row("Vraag", i.text, itemSummary(p, i), i.show_if ? short(i.show_if) : null, () => setEdit({ kind: "item", page: pi, item: ii }), { item: { page: pi, idx: ii }, badge: badge(p, i), linked: !!i["library_code"] }))}
                </div>}
                {collapsed.has(p.id) && ((n += items.length), null)}
                {editable && !collapsed.has(p.id) && <div className="mt-2"><TextLink onClick={() => setEdit({ kind: "item", page: pi, item: null })}>Vraag aan deze pagina toevoegen</TextLink></div>}
              </div>
            );
          })}
        </div>
        {editable && (
          <div className="mt-4 flex flex-col gap-3">
            <div><PillButton variant="outline" onClick={() => setAdding((a) => !a)} aria-expanded={adding}><PlusIcon />Vraag of pagina toevoegen</PillButton></div>
            {adding && <AddList itemTypes={opts(org, "questionnaire_item_type")} pageTypes={opts(org, "questionnaire_page_type")} onPick={addRow} library={library} />}
          </div>
        )}
      </Card>

      <Card title="Instellingen van deze vragenlijst">
        <fieldset disabled={!editable} className="grid grid-cols-2 gap-4">
          <Select label="Moment" value={def.moment} onChange={(v) => writeDef({ ...def, moment: v })} options={opts(org, "questionnaire_moment")} />
          <MultiSelect label="Gekoppeld aan" value={linked.map((t) => t.id)} onChange={(ids) => mut.mutate(() => linkTreatments(q.key, q.moment, ids, org.treatments))} options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))} />
          {Object.entries((def["outcomes"] ?? {}) as Record<string, string>).map(([k, v]) => (
            <Select key={k} label={k === "red" ? "Bij rood" : k === "green" ? "Bij groen" : "Uitkomst"} value={v} onChange={(x) => writeDef({ ...def, outcomes: { ...(def["outcomes"] as Record<string, string>), [k]: x } })} options={opts(org, "questionnaire_outcome")} />
          ))}
        </fieldset>
      </Card>

      {Object.keys(settings).some((k) => k === "bmi") && (
        <Card title="Grenswaarden" description={`Waarden van versie ${working.version_no}${inEdit ? " · concept" : " · alleen-lezen"}.`} action={inEdit && pub && configurationChanges(pub.version_config, working.version_config).length > 0 ? <VersionPill tone="draft">Gewijzigd</VersionPill> : undefined}>
          <table className="w-full">
            <thead><tr className="border-b border-line"><th className={thCls}>Regel</th><th className={thCls}>Standaard</th><th className={thCls}>Verlaagd, bij herkomst uit de genoemde regio’s</th></tr></thead>
            <tbody className="divide-y divide-line">
              {THRESHOLDS.map((r) => {
                const v = (p: string) => String(p.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], settings) ?? "–").replace(".", ",");
                return <tr key={r.label}><td className={tdCls}>{names.thresholds[r.std] || r.label}</td><td className={tdCls}>{v(r.std)}{r.unit ?? ""}</td><td className={tdCls}>{v(r.red)}{r.unit ?? ""}</td></tr>;
              })}
            </tbody>
          </table>
          {editable && <div className="mt-4"><PillButton variant="outline" onClick={() => setEdit({ kind: "thresholds" })}>Grenswaarden wijzigen</PillButton></div>}
        </Card>
      )}

      <Card title="Berekende velden" description="Eenvoudige formules met velden tussen accolades. Je gebruikt ze in voorwaarden en in teksten.">
        <table className="w-full" onClick={rowOpen}>
          <thead><tr className="border-b border-line"><th className={thCls}>Veld</th><th className={thCls}>Formule</th><th className={thCls}>Voorbeeld</th><th className={thCls} /></tr></thead>
          <tbody className="divide-y divide-line">
            {Object.entries(computed).map(([k, f]) => (
              <tr key={k} {...(editable ? { "data-list-row": "" } : {})}><td className={tdCls}>{names.computed[k] || "Berekend veld zonder naam"}</td><td className={cn(tdCls, "font-mono text-xs")}>{f}</td><td className={tdCls}>{sample(f)}</td><td className={tdCls}>{editable && <button type="button" data-row-action aria-label={`${names.computed[k] || k} wijzigen`} onClick={() => setEdit({ kind: "computed", name: k })} className="text-primary"><RowChevron /></button>}</td></tr>
            ))}
          </tbody>
        </table>
        {editable && <div className="mt-4"><PillButton variant="outline" onClick={() => setEdit({ kind: "computed", name: null })}><PlusIcon />Berekend veld toevoegen</PillButton></div>}
      </Card>

      </div>
      <aside className="sticky top-24 flex flex-col gap-6">
        <Card title="Zo ziet de patiënt het" description={previewLabel}>
          {selPage ? (
            <div className="h-[560px] w-[252px] overflow-hidden rounded-[18px] ring-1 ring-line">
              <div className="origin-top-left scale-[0.646]" style={{ width: 390 }}>
                <QuestionnaireRunner key={`${working.id}-${selPage.id}-${JSON.stringify(selPage).length}`} flow={{ settings, computed_fields: computed }} def={def} ui={data.uiTexts} today={today} startPageId={selPage.id} />
              </div>
            </div>
          ) : <p className="text-sm text-muted-foreground">Klik links op een regel.</p>}
          <p className="mt-3 text-[13px] text-muted-foreground">{archived ? `Toont versie ${archived.version_no} (archief).` : inEdit && draft ? `Toont versie ${draft.version_no} (concept). Patiënten zien dit pas na publiceren.` : `Toont versie ${working.version_no}${pub?.id === working.id ? " (live)" : ""}.`}</p>
        </Card>
      </aside>
      </div>

      {edit?.kind === "boodschap" && (() => {
        const nums = questionNumbers(def);
        const current = edit.index === null ? null : (def.pages[edit.index] ?? null);
        const prev = edit.index === null ? (sel === null ? def.pages.at(-1)?.id : def.pages[sel]?.id) : def.pages[edit.index - 1]?.id;
        const pr = org.practitioners.find((x) => x.status === "active");
        return (
          <BoodschapModal page={current} after={prev ?? START} positions={flowPositions(def, nums, current?.id)} forms={opts(org, "boodschap_form")} images={opts(org, "questionnaire_image")} buttons={opts(org, "questionnaire_button")}
            ctx={ctx} questionnaireName={def.name} def={def} flow={{ settings, computed_fields: computed }} ui={data.uiTexts}
            practitioner={{ name: pr ? `${pr.first_name} ${pr.last_name}` : "", text: pr?.bio_nl ?? "" }}
            onClose={() => setEdit(null)} onSave={(p, after) => saveBoodschap(p, edit.index, after)}
            onDelete={edit.index === null ? undefined : () => setPages(def.pages.filter((_, i) => i !== edit.index))} />
        );
      })()}
      {edit?.kind === "page" && (
        <PageModal page={edit.index === null ? null : (def.pages[edit.index] ?? null)} initialType={edit.type} pageTypes={opts(org, "questionnaire_page_type").filter((o) => o.value !== "boodschap")} sections={sections} icons={icons} iconCategories={opts(org, "icon_category")} ctx={ctx} questionnaireName={def.name}
          onSave={(p) => savePage(p, edit.index)} onClose={() => setEdit(null)}
          onDelete={edit.index === null ? undefined : () => setPages(def.pages.filter((_, i) => i !== edit.index))} />
      )}
      {edit?.kind === "item" && (() => {
        const p = edit.page === null ? undefined : def.pages[edit.page];
        const item = p && edit.item !== null ? (p.items?.[edit.item] ?? null) : null;
        return (
          <ItemModal item={item} initialType={edit.type} number={item ? (questionNumbers(def)[item.id] ?? 0) : Object.keys(questionNumbers(def)).length + 1} questionnaireName={def.name} questionnaireId={q.id} def={def} page={p}
            flow={{ settings, computed_fields: computed }} ui={data.uiTexts} images={opts(org, "questionnaire_image")} itemTypes={opts(org, "questionnaire_item_type")} sections={sections} section={p?.section} rejections={rejections} ctx={ctx}
            onSave={(i, s, pageCondition) => saveItem(i, s, edit.page, edit.item, pageCondition)} onClose={() => setEdit(null)}
            onDelete={edit.page === null || edit.item === null ? undefined : () => {
              const pi = edit.page as number, ii = edit.item as number;
              const pages = def.pages.map((x, i) => (i === pi ? { ...x, items: (x.items ?? []).filter((_, j) => j !== ii) } : x)).filter((x, i) => i !== pi || (x.items?.length ?? 0) > 0 || x.title);
              setPages(pages);
            }} />
        );
      })()}
      {edit?.kind === "thresholds" && editable && (
        <ThresholdsModal settings={settings} rows={THRESHOLDS} names={names.thresholds} onClose={() => setEdit(null)} onSave={(s, labels) => writeDef({ ...def, version_config: { ...doc, settings: s, field_names: { ...names, thresholds: labels } } })} />
      )}
      {edit?.kind === "computed" && editable && (
        <ComputedModal name={edit.name} displayName={edit.name ? names.computed[edit.name] ?? "" : ""} formula={edit.name ? (computed[edit.name] ?? "") : ""} sample={sample} onClose={() => setEdit(null)}
          onSave={(name, f, label) => writeDef({ ...def, version_config: { ...doc, computed_fields: { ...computed, [name]: f }, field_names: { ...names, computed: { ...names.computed, [name]: label } } } })}
          onDelete={edit.name ? () => { const c = { ...computed }, labels = { ...names.computed }; delete c[edit.name as string]; delete labels[edit.name as string]; writeDef({ ...def, version_config: { ...doc, computed_fields: c, field_names: { ...names, computed: labels } } }); } : undefined} />
      )}
      {edit?.kind === "publish" && draft && (
        <PublishDialog name={def.name} moment={optLabel(org, "questionnaire_moment", q.moment)} liveNo={pub?.version_no ?? null} draftNo={draft.version_no} changes={changes} busy={mut.isPending}
          running={pub ? (counts.data?.[pub.id]?.open ?? 0) : 0} testLink={testLink(draft, "Eerst testen als patiënt", "link")} onClose={() => setEdit(null)}
          onPublish={() => mut.mutate(async () => { await publishVersion(q.id, draft.id); setEditing(false); setNotice(null); toast.success(`Versie ${draft.version_no} staat nu live`); })} />
      )}
      {edit?.kind === "discard" && draft && (
        <DiscardDialog draftNo={draft.version_no} liveNo={pub?.version_no ?? null} changes={changes.length} busy={mut.isPending} onClose={() => setEdit(null)}
          onConfirm={() => mut.mutate(async () => { await discardDraft(draft.id); setEditing(false); setNotice(null); toast.success(`Concept weggegooid; versie ${pub?.version_no ?? ""} blijft live`); })} />
      )}
      {edit?.kind === "versions" && (
        <VersionsDialog versions={versions} names={names_} draftChanges={changes.length} onClose={() => setEdit(null)}
          onContinue={() => { setEdit(null); setArchiveId(null); setEditing(true); }}
          onView={(v) => { setEdit(null); setArchiveId(v.id); setSel(0); }}
          onUse={(v) => mut.mutate(async () => { await useVersionAsDraft(q.id, v, draft); setEdit(null); setArchiveId(null); setEditing(true); toast.success(`Versie ${v.version_no} staat klaar als concept`); })}
          onExport={download}
          onImport={(f) => mut.mutate(async () => { const json = JSON.parse(await f.text()) as FlowFile; await importFlow(json, flow?.key ?? "flow", false); setEdit(null); setEditing(true); toast.success("Geïmporteerd als concept"); })} />
      )}
    </div>
  );
}
