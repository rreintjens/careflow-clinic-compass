import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronRight, GripVertical, Pencil } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { PlusIcon, SearchField, TextField } from "@/components/Field";
import { ListPage } from "@/components/ListPage";
import { CustomIconsProvider, MenuIcon } from "@/components/MenuIcon";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { SearchablePicker } from "@/components/SearchablePicker";
import { Select } from "@/components/Select";
import { UiIcon } from "@/components/UiIcon";
import joyceAsset from "@/assets/joyce-maas.jpg.asset.json";
import {
  addPlacement, createGroup, createMenuTreatment, dissolveGroup, menuData, moveMenuItem, orgQuery, removePlacement, setTreatmentAddon, setTreatmentIcon, updateGroup, uploadCustomIcon,
  type Org,
} from "@/data/organisation";
import { canAddGroup, children, depth, moveError, parentsOfTreatment, pathLabel, resolveIcon, treatmentsIn, visibleChildren, type MenuData, type MenuItem, type Parent } from "@/domain/menu";
import { durationOptions } from "@/domain/organisation";
import { ADDON_MINUTES, addonExplain, groupAddon, parseAddon, type Addon } from "@/domain/addons";
import { currentTenantQuery } from "@/data/tenant";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { treatmentBookability } from "@/features/organisation/bookability";
import { EquipmentKindsModal } from "@/features/organisation/EquipmentKindsModal";
import { IconPicker } from "@/features/organisation/IconPicker";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/behandelingen/")({
  head: () => ({ meta: [{ title: "Behandelingen · Beheer · The Body Clinic" }, { name: "description", content: "Het menu van de online agenda: groepen en behandelingen in de volgorde van de patiënt." }, { property: "og:title", content: "Behandelingen · Beheer · The Body Clinic" }, { property: "og:description", content: "Het menu van de online agenda: groepen en behandelingen in de volgorde van de patiënt." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(orgQuery),
  component: TreatmentsPage,
});

type Where = Parent | "none";
type Drag = { item: MenuItem; from: Where };
type Drop = { key: string; pos: "before" | "inside" | "after" } | null;
const keyOf = (it: MenuItem, parent: Where) => `${it.kind}:${it.id}@${parent ?? "top"}`;

const joinNl = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} en ${xs[xs.length - 1]}`);

/** Plain-words booking problem of a treatment, or "" when it is bookable everywhere it is offered. */
function treatmentWarning(org: Org, id: string): string {
  const t = org.treatments.find((x) => x.id === id);
  if (!t) return "";
  if (t.status !== "active") return "Niet actief";
  if (t.online_booking !== "bookable") return "Niet online boekbaar";
  const b = treatmentBookability(org, id);
  if (b.total === 0) return "Nergens aangeboden";
  const bad = b.perLocation.filter((p) => p.reason !== "ok").map((p) => org.locations.find((l) => l.id === p.locationId)?.name ?? "");
  return bad.length ? `Niet in ${joinNl(bad)}` : "";
}

function TreatmentsPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const qc = useQueryClient();
  const m = useMemo(() => menuData(org), [org]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [sel, setSel] = useState<Parent>(null);
  const [q, setQ] = useState("");
  const [problems, setProblems] = useState(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop>(null);
  const [kindsOpen, setKindsOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<string | null>(null);
  const [editTreatment, setEditTreatment] = useState<string | null>(null);
  const [addIn, setAddIn] = useState<Parent | undefined>(undefined);
  const hoverTimer = useRef<number | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });

  const name = (id: string) => org.categories.find((c) => c.id === id)?.name_nl ?? org.treatments.find((t) => t.id === id)?.name_nl ?? "";
  const warn = useMemo(() => new Map(org.treatments.map((t) => [t.id, treatmentWarning(org, t.id)])), [org]);
  const placed = new Set([...org.categoryLinks.map((l) => l.treatment_id), ...org.menuRoots.map((r) => r.treatment_id)]);
  const problemCount = org.treatments.filter((t) => placed.has(t.id) && warn.get(t.id)).length;
  const groupIcon = (id: string) => org.categories.find((c) => c.id === id)?.icon;
  const icon = (own: string | null | undefined, parent: Parent) => resolveIcon({ ...m, groupIcon }, own, parent, org.menuDefaultIcon);

  const run = useMutation({
    mutationFn: (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => refresh(),
    onError: (e) => { toast.error(errorText(e)); void refresh(); },
  });

  // ----- filtering -----
  const needle = q.trim().toLowerCase();
  const filtering = !!needle || problems;
  const treatmentMatches = (id: string) => (!needle || name(id).toLowerCase().includes(needle)) && (!problems || !!warn.get(id));
  const filtered = (parent: Parent, forced: boolean): MenuItem[] =>
    children(m, parent).filter((it) => {
      if (!filtering) return true;
      if (it.kind === "treatment") return (forced && !problems) || treatmentMatches(it.id) || (forced && problems && !!warn.get(it.id));
      const hit = !!needle && name(it.id).toLowerCase().includes(needle);
      return (hit && !problems) || filtered(it.id, forced || hit).length > 0;
    });
  const isOpen = (id: string) => filtering || open.has(id);
  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const openAll = () => setOpen(new Set(org.categories.map((c) => c.id)));

  // ----- drag and drop -----
  const refuse = (msg: string) => toast.error(msg);
  const onOver = (e: DragEvent, it: MenuItem, parent: Where) => {
    if (!drag) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    const pos: "before" | "inside" | "after" = it.kind === "group" && y > 0.28 && y < 0.72 ? "inside" : y < 0.5 ? "before" : "after";
    const key = keyOf(it, parent);
    if (drop?.key !== key || drop.pos !== pos) {
      setDrop({ key, pos });
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
      if (pos === "inside" && it.kind === "group" && !open.has(it.id)) hoverTimer.current = window.setTimeout(() => setOpen((s) => new Set(s).add(it.id)), 600);
    }
  };
  const doMove = (to: Where, index: number) => {
    if (!drag) return;
    const d = drag;
    setDrag(null); setDrop(null);
    if (to === "none") {
      if (d.item.kind === "group") return refuse("Kan niet: alleen behandelingen kunnen uit het menu");
      if (d.from === "none") return;
      return run.mutate(() => moveMenuItem(org, d.item, d.from, "none", 0));
    }
    const err = moveError(m, d.item, (d.from === "none" ? "__none__" : d.from) as Parent, to, org.menuMaxDepth);
    if (err) return refuse(err);
    let idx = index;
    if (d.from === to) {
      const cur = children(m, to).findIndex((x) => x.kind === d.item.kind && x.id === d.item.id);
      if (cur >= 0 && cur < idx) idx--;
    }
    run.mutate(() => moveMenuItem(org, d.item, d.from, to, idx));
  };
  const onDropRow = (e: DragEvent, it: MenuItem, parent: Parent) => {
    e.preventDefault();
    e.stopPropagation();
    const pos = drop?.key === keyOf(it, parent) ? drop.pos : "after";
    if (pos === "inside" && it.kind === "group") return doMove(it.id, children(m, it.id).length);
    const at = children(m, parent).findIndex((x) => x.kind === it.kind && x.id === it.id);
    doMove(parent, pos === "before" ? at : at + 1);
  };

  // ----- group warnings -----
  const groupNote = (id: string): { text: string; warn: boolean } | null => {
    if (treatmentsIn(m, id).length === 0) return { text: "Leeg, dus niet zichtbaar voor de patiënt", warn: true };
    const direct = children(m, id).filter((x) => x.kind === "treatment").map((x) => warn.get(x.id) ?? "");
    if (direct.length >= 2 && direct[0] && direct.every((w) => w === direct[0])) return { text: `Alle ${direct.length}: ${direct[0].charAt(0).toLowerCase()}${direct[0].slice(1)}`, warn: true };
    return null;
  };
  const sharedWarning = (parent: Parent) => {
    if (!parent) return false;
    return !!groupNote(parent)?.text.startsWith("Alle ");
  };

  const rows: React.ReactNode[] = [];
  const render = (parent: Parent, level: number, forced: boolean) => {
    for (const it of filtered(parent, forced)) {
      const k = keyOf(it, parent);
      const indicator = drop?.key === k ? drop.pos : null;
      const common = {
        draggable: true,
        onDragStart: (e: DragEvent) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", k); setDrag({ item: it, from: parent }); },
        onDragEnd: () => { setDrag(null); setDrop(null); },
        onDragOver: (e: DragEvent) => onOver(e, it, parent),
        onDrop: (e: DragEvent) => onDropRow(e, it, parent),
      };
      if (it.kind === "group") {
        const g = org.categories.find((c) => c.id === it.id);
        if (!g) continue;
        const ic = icon(g.icon, g.parent_id);
        const note = groupNote(g.id);
        const hit = !!needle && g.name_nl.toLowerCase().includes(needle);
        rows.push(
          <div key={k} {...common} className="relative">
            {indicator === "before" && <span className="absolute inset-x-2 top-0 h-0.5 rounded bg-primary" />}
            <div role="button" tabIndex={0} aria-expanded={isOpen(g.id)} onClick={() => { toggle(g.id); setSel(g.id); }} onKeyDown={(e) => { if (e.key === "Enter") { toggle(g.id); setSel(g.id); } }}
              className={cn("group/row flex min-h-[52px] cursor-pointer items-center gap-2 rounded-xl pr-2 hover:bg-sand/60", sel === g.id && "bg-teal-light hover:bg-teal-light", indicator === "inside" && "bg-teal-light")}
              style={{ paddingLeft: 4 + level * 26 }}>
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/row:opacity-100" aria-hidden="true" />
              <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen(g.id) && "rotate-90")} aria-hidden="true" />
              <MenuIcon icon={ic.icon} inherited={ic.inherited} />
              <span className="min-w-0 flex-1">
                <span className={cn("block truncate text-sm font-medium", sel === g.id && "text-primary")}>{g.name_nl}</span>
                {note && <span className={cn("block truncate text-xs", note.warn ? "text-warning" : "text-muted-foreground")}>{note.text}</span>}
                {parseAddon(g.addon) && <span className="block truncate text-xs text-muted-foreground">Toevoeging voor alles hieronder: {addonShort(parseAddon(g.addon))}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{treatmentsIn(m, g.id).length}</span>
              <button type="button" aria-label={`${g.name_nl} bewerken`} onClick={(e) => { e.stopPropagation(); setEditGroup(g.id); }}
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-primary opacity-0 hover:bg-background focus-visible:opacity-100 group-hover/row:opacity-100"><Pencil className="size-4" /></button>
            </div>
            {indicator === "after" && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-primary" />}
          </div>,
        );
        if (isOpen(g.id)) {
          render(g.id, level + 1, forced || hit);
          if (sel === g.id && !filtering) rows.push(
            <button key={`add-${g.id}`} type="button" onClick={() => setAddIn(g.id)} className="flex h-10 items-center gap-2 rounded-xl text-sm text-primary hover:bg-sand/60" style={{ paddingLeft: 30 + (level + 1) * 26 }}>
              <PlusIcon />Toevoegen in {g.name_nl}
            </button>,
          );
        }
      } else {
        const t = org.treatments.find((x) => x.id === it.id);
        if (!t) continue;
        const ic = icon(t.icon, parent);
        const w = warn.get(t.id) ?? "";
        const others = parentsOfTreatment(m, t.id).filter((p) => p !== parent).map((p) => (p ? name(p) : "Eerste laag"));
        rows.push(
          <div key={k} {...common} className="relative">
            {indicator === "before" && <span className="absolute inset-x-2 top-0 h-0.5 rounded bg-primary" />}
            <div role="button" tabIndex={0} onClick={() => setEditTreatment(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setEditTreatment(t.id); }}
              className="group/row flex min-h-[48px] cursor-pointer items-center gap-2 rounded-xl pr-2 hover:bg-sand/60" style={{ paddingLeft: 4 + level * 26 }}>
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/row:opacity-100" aria-hidden="true" />
              <span className="size-4 shrink-0" />
              <MenuIcon icon={ic.icon} inherited={ic.inherited} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{t.name_nl}</span>
                {parseAddon(t.addon) && <span className="block truncate text-xs text-muted-foreground">Toevoeging: {addonShort(parseAddon(t.addon))}</span>}
                {(w && !sharedWarning(parent)) || others.length ? (
                  <span className="block truncate text-xs">
                    {w && !sharedWarning(parent) && <span className="text-warning">{w}</span>}
                    {w && !sharedWarning(parent) && others.length ? <span className="text-muted-foreground"> · </span> : null}
                    {others.length > 0 && <span className="text-primary">Ook in {joinNl(others)}</span>}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">{t.duration_min} min</span>
            </div>
            {indicator === "after" && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-primary" />}
          </div>,
        );
      }
    }
  };
  render(null, 0, false);

  const unplaced = org.treatments.filter((t) => !placed.has(t.id) && treatmentMatches(t.id));
  const toolbarTarget: Parent = sel;

  return (
    <CustomIconsProvider icons={org.customIcons}>
      <ListPage>
        <PageHeader title="Behandelingen" actions={<PillButton variant="outline" onClick={() => setKindsOpen(true)}>Soorten apparatuur</PillButton>} />
        {kindsOpen && <EquipmentKindsModal org={org} onClose={() => setKindsOpen(false)} />}
        <div className="flex flex-wrap items-center gap-3">
          <SearchField placeholder="Zoek een groep of behandeling" value={q} onChange={(e) => setQ(e.target.value)} className="w-full sm:w-[300px]" aria-label="Zoek een groep of behandeling" />
          {problemCount > 0 && (
            <button type="button" aria-pressed={problems} onClick={() => setProblems(!problems)}
              className={cn("inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full px-4 text-sm transition-colors", problems ? "bg-warning text-primary-foreground" : "bg-warning-bg text-warning hover:bg-signal")}>
              <UiIcon name="waarschuwing" className="size-4" />{problemCount} niet overal boekbaar
            </button>
          )}
          <span className="flex-1" />
          <PillButton variant="ghost" onClick={openAll}>Alles openklappen</PillButton>
          <PillButton onClick={() => setAddIn(toolbarTarget)}><PlusIcon />Toevoegen</PillButton>
        </div>
        <div className="mt-5 grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0" aria-label="Menu van de online agenda">
            <button type="button" onClick={() => setSel(null)}
              onDragOver={(e) => { if (drag) { e.preventDefault(); setDrop({ key: "top", pos: "inside" }); } }}
              onDrop={(e) => { e.preventDefault(); doMove(null, children(m, null).length); }}
              className={cn("mb-1 flex h-10 w-full items-center rounded-xl px-3 text-left text-[13px] text-muted-foreground hover:bg-sand/60", sel === null && "bg-teal-light text-primary hover:bg-teal-light", drop?.key === "top" && "bg-teal-light")}>
              Eerste laag
            </button>
            <div className="flex flex-col">{rows}</div>
            {sel === null && !filtering && (
              <button type="button" onClick={() => setAddIn(null)} className="flex h-10 items-center gap-2 rounded-xl pl-[34px] text-sm text-primary hover:bg-sand/60"><PlusIcon />Toevoegen in de eerste laag</button>
            )}
            {filtering && rows.length === 0 && <p className="py-6 text-sm text-muted-foreground">Niets gevonden.</p>}

            <div onDragOver={(e) => { if (drag) { e.preventDefault(); setDrop({ key: "none", pos: "inside" }); } }} onDrop={(e) => { e.preventDefault(); doMove("none", 0); }}
              className={cn("mt-8 rounded-[16px] bg-sand/50 p-3", drop?.key === "none" && "bg-teal-light")}>
              <h2 className="px-1 text-sm font-semibold">Niet in het menu <span className="font-normal text-muted-foreground">· {unplaced.length}</span></h2>
              <p className="mb-2 px-1 text-xs text-muted-foreground">Alleen boekbaar via een directe boekingslink.</p>
              {unplaced.map((t) => {
                const ic = icon(t.icon, null);
                return (
                  <div key={t.id} draggable onDragStart={() => setDrag({ item: { kind: "treatment", id: t.id }, from: "none" })} onDragEnd={() => { setDrag(null); setDrop(null); }}
                    role="button" tabIndex={0} onClick={() => setEditTreatment(t.id)} onKeyDown={(e) => { if (e.key === "Enter") setEditTreatment(t.id); }}
                    className="group/row flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl px-1 hover:bg-background">
                    <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground opacity-0 group-hover/row:opacity-100" aria-hidden="true" />
                    <MenuIcon icon={ic.icon} inherited={ic.inherited} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.name_nl}</span>
                    <span className="text-xs text-muted-foreground">{t.duration_min} min</span>
                  </div>
                );
              })}
            </div>
          </section>
          <aside className="xl:sticky xl:top-6">
            <PhonePreview org={org} m={m} sel={sel} onGroup={(id) => { setSel(id); if (id) setOpen((s) => { const n = new Set(s); let cur: string | null = id; while (cur) { n.add(cur); cur = org.categories.find((c) => c.id === cur)?.parent_id ?? null; } return n; }); }} />
          </aside>
        </div>

        {editGroup && <GroupModal org={org} m={m} id={editGroup} onClose={() => setEditGroup(null)} onDone={refresh} />}
        {editTreatment && <TreatmentModal org={org} m={m} id={editTreatment} warning={warn.get(editTreatment) ?? ""} onClose={() => setEditTreatment(null)} onDone={refresh} />}
        {addIn !== undefined && <AddModal org={org} m={m} parent={addIn} onClose={() => setAddIn(undefined)} onDone={refresh} />}
      </ListPage>
    </CustomIconsProvider>
  );
}

function addonShort(a: Addon | null): string {
  if (!a || a.type === "none") return "geen";
  if (a.type === "consult") return `consult erbij, ${a.minutes} minuten extra`;
  return `pakket "${a.label}", € ${a.price_eur}`;
}

/** "Toevoeging na het kiezen": like the group, none, consult erbij (15/30/45 min) or, on a treatment, a pakket. */
function AddonField({ value, inherited, forTreatment, kind, onChange }: { value: Addon | null; inherited: Addon | null; forTreatment: boolean; kind?: string; onChange: (a: Addon | null) => void }) {
  const mode = value ? value.type : "inherit";
  const opts = [{ value: "inherit", label: "Zoals de groep" }, { value: "none", label: "Geen toevoeging" }, { value: "consult", label: "Consult erbij" }, ...(forTreatment ? [{ value: "pakket", label: "Pakket" }] : [])];
  const set = (v: string) => onChange(v === "inherit" ? null : v === "none" ? { type: "none" } : v === "consult" ? { type: "consult", minutes: value?.type === "consult" ? value.minutes : 15 } : { type: "pakket", label: value?.type === "pakket" ? value.label : "", price_eur: value?.type === "pakket" ? value.price_eur : 0, question: value?.type === "pakket" ? value.question : "" });
  const shown = value ?? inherited;
  const explain = forTreatment && kind && kind !== "behandeling" ? "Dit is een " + kind + "; die krijgt nooit een toevoeging." : addonExplain(shown && shown.type === "pakket" && !value ? null : shown, !value);
  return (
    <div className="flex flex-col gap-3 rounded-[14px] bg-sand/60 p-4">
      <span className="text-[13px] font-medium">Toevoeging na het kiezen</span>
      <Select label="Soort" value={mode} onChange={set} options={opts} preserveOrder />
      {value?.type === "consult" && <Select label="Extra minuten" value={String(value.minutes)} onChange={(v) => onChange({ type: "consult", minutes: Number(v) })} options={ADDON_MINUTES.map((n) => ({ value: String(n), label: `${n} minuten` }))} preserveOrder />}
      {value?.type === "pakket" && (
        <>
          <TextField label="Vraag" value={value.question} onChange={(e) => onChange({ ...value, question: e.target.value })} />
          <TextField label="Naam pakket" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
          <TextField label="Prijs pakket (euro)" inputMode="decimal" value={String(value.price_eur || "")} onChange={(e) => onChange({ ...value, price_eur: Number(e.target.value.replace(",", ".")) || 0 })} />
        </>
      )}
      <p className="text-xs text-muted-foreground">{!value && inherited ? `Van de groep: ${addonShort(inherited)}. ` : ""}{explain}</p>
    </div>
  );
}

function errorText(e: unknown) {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : "";
  return msg.startsWith("Kan niet") ? msg.replace("maximaal 3 lagen", "maximaal drie lagen") : "Opslaan is niet gelukt";
}

/** Indented select options for every group, plus the top level. */
function placeOptions(org: Org, m: MenuData, disabled: (p: Parent) => string | null = () => null) {
  const out: Array<{ value: string; label: string; group: string; disabled?: boolean; reason?: string }> = [];
  const top = disabled(null);
  out.push({ value: "top", label: "Eerste laag", group: "", ...(top ? { disabled: true, reason: top } : {}) });
  const walk = (parent: Parent, level: number) => {
    for (const it of children(m, parent)) if (it.kind === "group") {
      const why = disabled(it.id);
      out.push({ value: it.id, label: `${"\u2002".repeat(level * 2)}${org.categories.find((c) => c.id === it.id)?.name_nl ?? ""}`, group: "", ...(why ? { disabled: true, reason: why } : {}) });
      walk(it.id, level + 1);
    }
  };
  walk(null, 1);
  return out;
}
const toParent = (v: string): Parent => (v === "top" ? null : v);

function useIconUpload(onDone: () => Promise<unknown>) {
  return async (file: File) => { const key = await uploadCustomIcon(file); await onDone(); return key; };
}

function IconField({ org, m, own, parent, onChange, onDone }: { org: Org; m: MenuData; own: string | null; parent: Parent; onChange: (v: string | null) => void; onDone: () => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const upload = useIconUpload(onDone);
  const fb = resolveIcon({ ...m, groupIcon: (id) => org.categories.find((c) => c.id === id)?.icon }, null, parent, org.menuDefaultIcon);
  const fbLabel = parent && fb.icon !== org.menuDefaultIcon ? "het icoon van de groep erboven" : "het standaardicoon uit Instellingen › Algemeen";
  return (
    <div>
      <span className="text-[13px] font-medium">Icoon</span>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-[14px] bg-sand"><MenuIcon icon={own ?? fb.icon} inherited={!own} /></span>
        <PillButton variant="outline" onClick={() => setOpen(true)}>{own ? "Ander icoon" : "Icoon kiezen"}</PillButton>
        {own && <PillButton variant="ghost" onClick={() => onChange(null)}>Eigen icoon weghalen</PillButton>}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">Zonder eigen icoon zie je {fbLabel}.</p>
      {open && <IconPicker value={own} fallback={fb.icon} custom={org.customIcons} onUpload={upload} onPick={(v) => { onChange(v); setOpen(false); }} onClose={() => setOpen(false)} />}
    </div>
  );
}

function GroupModal({ org, m, id, onClose, onDone }: { org: Org; m: MenuData; id: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const g = org.categories.find((c) => c.id === id);
  const [name, setName] = useState(g?.name_nl ?? "");
  const [icon, setIcon] = useState<string | null>(g?.icon ?? null);
  const [confirm, setConfirm] = useState(false);
  const [addon, setAddon] = useState<Addon | null>(parseAddon(g?.addon));
  const save = useMutation({ mutationFn: () => updateGroup(id, { name_nl: name.trim(), icon, addon }), onSuccess: async () => { await onDone(); toast.success("Opgeslagen"); onClose(); }, onError: (e) => toast.error(errorText(e)) });
  const dissolve = useMutation({ mutationFn: () => dissolveGroup(org, id), onSuccess: async () => { await onDone(); toast.success("Groep opgeheven"); onClose(); }, onError: (e) => toast.error(errorText(e)) });
  if (!g) return null;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={g.name_nl}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="flex flex-col gap-5">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
        <IconField org={org} m={m} own={icon} parent={g.parent_id} onChange={setIcon} onDone={onDone} />
        <AddonField value={addon} inherited={groupAddon(org.categories, g.parent_id)} forTreatment={false} onChange={setAddon} />
        <p className="text-sm text-muted-foreground">Laag {depth(m, id)} van maximaal {org.menuMaxDepth}</p>
        <div className="rounded-[14px] bg-sand p-4">
          {!confirm ? (
            <PillButton variant="ghost" className="text-warning" onClick={() => setConfirm(true)}>Groep opheffen</PillButton>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm">De inhoud gaat één laag omhoog. Er wordt niets verwijderd.</p>
              <div className="flex flex-wrap gap-2">
                <PillButton variant="outline" onClick={() => setConfirm(false)}>Toch niet</PillButton>
                <PillButton disabled={dissolve.isPending} onClick={() => dissolve.mutate()}>Ja, opheffen</PillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function TreatmentModal({ org, m, id, warning, onClose, onDone }: { org: Org; m: MenuData; id: string; warning: string; onClose: () => void; onDone: () => Promise<unknown> }) {
  const t = org.treatments.find((x) => x.id === id);
  const places = parentsOfTreatment(m, id);
  const gname = (g: string) => org.categories.find((c) => c.id === g)?.name_nl ?? "";
  const act = useMutation({ mutationFn: (fn: () => Promise<unknown>) => fn(), onSuccess: () => onDone(), onError: (e) => toast.error(errorText(e)) });
  if (!t) return null;
  const options = placeOptions(org, m, (p) => (places.includes(p) ? "Staat hier al" : null));
  const ic = t.icon;
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title={t.name_nl} description={treatmentFacts(t)}
      footer={<><Link to="/organisatie/behandelingen/$id" params={{ id }} className="mr-auto self-center text-sm text-primary underline">Alle instellingen van deze behandeling</Link><PillButton onClick={onClose}>Klaar</PillButton></>}>
      <div className="flex flex-col gap-6">
        <IconField org={org} m={m} own={ic} parent={places[0] ?? null} onChange={(v) => act.mutate(() => setTreatmentIcon(id, v))} onDone={onDone} />
        <div>
          <span className="text-[13px] font-medium">Plek in het menu</span>
          <ul className="mt-2 flex flex-col gap-1">
            {places.map((p) => (
              <li key={p ?? "top"} className="flex min-h-11 items-center gap-3 rounded-[14px] bg-sand px-4">
                <span className="min-w-0 flex-1 truncate text-sm">{pathLabel(m, p, gname)}</span>
                <button type="button" className="shrink-0 text-sm text-warning underline" onClick={() => act.mutate(() => removePlacement(id, p))}>Haal hier weg</button>
              </li>
            ))}
            {places.length === 0 && <li className="text-sm text-muted-foreground">Niet in het menu: alleen boekbaar via een directe boekingslink.</li>}
          </ul>
          <SearchablePicker className="mt-3" label="Ook op een andere plek zetten…" options={options} value="" preserveOrder
            onChange={(v) => { const p = v[0]; if (p !== undefined && p !== "") act.mutate(() => addPlacement(org, id, toParent(p))); }} />
        </div>
        <TreatmentAddon org={org} id={id} parent={places[0] ?? null} onDone={onDone} />
        <TreatmentInfo org={org} id={id} />
        <div>
          <span className="text-[13px] font-medium">Boekbaar</span>
          <p className={cn("mt-1 text-sm", warning ? "text-warning" : "text-muted-foreground")}>{warning ? bookabilityDetail(org, id, warning) : "Overal waar hij wordt aangeboden."}</p>
        </div>
      </div>
    </Modal>
  );
}

type OrgTreatment = Org["treatments"][number];
const eur = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);
function treatmentFacts(t: OrgTreatment) {
  const kind = { consult: "Consult", controle: "Controle", behandeling: "Behandeling" }[t.kind] ?? "";
  return [kind, `${t.duration_min} minuten`, t.price_cents != null ? `${t.price_is_from ? "vanaf " : ""}${eur(t.price_cents)}` : "geen prijs"].join(" · ");
}

function TreatmentAddon({ org, id, parent, onDone }: { org: Org; id: string; parent: Parent; onDone: () => Promise<unknown> }) {
  const t = org.treatments.find((x) => x.id === id);
  const [v, setV] = useState<Addon | null>(parseAddon(t?.addon));
  const saved = JSON.stringify(parseAddon(t?.addon)) === JSON.stringify(v);
  const save = useMutation({ mutationFn: () => setTreatmentAddon(id, v), onSuccess: async () => { await onDone(); toast.success("Opgeslagen"); }, onError: (e) => toast.error(errorText(e)) });
  if (!t) return null;
  const ready = v?.type !== "pakket" || (!!v.label.trim() && v.price_eur > 0 && !!v.question.trim());
  return (
    <div className="flex flex-col gap-2">
      <AddonField value={v} inherited={groupAddon(org.categories, parent)} forTreatment kind={t.kind} onChange={setV} />
      {!saved && <PillButton size="sm" className="self-start" disabled={!ready || save.isPending} onClick={() => save.mutate()}>Toevoeging opslaan</PillButton>}
    </div>
  );
}

/** Description, payment, locations with the number of practitioners, questionnaires. */
function TreatmentInfo({ org, id }: { org: Org; id: string }) {
  const t = org.treatments.find((x) => x.id === id);
  const keys = [t?.pre_questionnaire_key, t?.post_questionnaire_key].filter((k): k is string => !!k);
  const { data: qs = [] } = useQuery({ queryKey: ["questionnaire-names", keys.join(",")], enabled: keys.length > 0, queryFn: async () => (await supabase.from("questionnaires").select("key, name").in("key", keys)).data ?? [] });
  if (!t) return null;
  const locs = org.locations.filter((l) => org.treatmentLocations.some((x) => x.treatment_id === id && x.location_id === l.id)).sort((a, z) => a.sort - z.sort);
  const count = (lid: string) => org.practitionerTreatments.filter((p) => p.treatment_id === id && !(p.excluded_location_ids ?? []).includes(lid)).length;
  const pay = t.online_payment ? `Online betalen bij het boeken${t.deposit_cents ? ` (${eur(t.deposit_cents)})` : ""}` : t.deposit_cents ? `Aanbetaling ${eur(t.deposit_cents)}, de rest in de kliniek` : "Betalen in de kliniek";
  const link = t.external_link as { label?: string; url?: string } | null;
  const qName = (k: string | null) => qs.find((q) => q.key === k)?.name ?? k;
  return (
    <div className="flex flex-col gap-4 text-sm">
      {t.description_nl && <div><span className="text-[13px] font-medium">Omschrijving</span><p className="mt-1 whitespace-pre-line text-muted-foreground">{t.description_nl}</p></div>}
      <div><span className="text-[13px] font-medium">Betalen</span><p className="mt-1 text-muted-foreground">{pay}</p></div>
      <div>
        <span className="text-[13px] font-medium">Locaties</span>
        {locs.length ? <ul className="mt-1 grid grid-cols-1 gap-x-4 sm:grid-cols-2">{locs.map((l) => <li key={l.id} className="flex justify-between gap-2 text-muted-foreground"><span>{l.name}</span><span>{count(l.id)} {count(l.id) === 1 ? "behandelaar" : "behandelaars"}</span></li>)}</ul>
          : <p className="mt-1 text-muted-foreground">Nergens te boeken, dus niet zichtbaar voor de patiënt.</p>}
      </div>
      {link?.url && <div><span className="text-[13px] font-medium">Externe link</span><p className="mt-1"><a href={link.url} target="_blank" rel="noreferrer" className="text-primary underline">{link.label ?? link.url}</a></p></div>}
      {keys.length > 0 && (
        <div>
          <span className="text-[13px] font-medium">Vragenlijsten</span>
          {t.pre_questionnaire_key && <p className="mt-1 text-muted-foreground">Voor het bevestigen: {qName(t.pre_questionnaire_key)}</p>}
          {t.post_questionnaire_key && <p className="text-muted-foreground">Na het boeken: {qName(t.post_questionnaire_key)} ({t.questionnaire_minutes} minuten)</p>}
        </div>
      )}
    </div>
  );
}

function bookabilityDetail(org: Org, id: string, warning: string) {
  const b = treatmentBookability(org, id);
  const why: Record<string, string> = { no_practitioner: "geen behandelaar", no_room: "geen kamer", no_equipment: "geen apparatuur" };
  const parts = b.perLocation.filter((p) => p.reason !== "ok").map((p) => `${org.locations.find((l) => l.id === p.locationId)?.name ?? ""}: ${why[p.reason] ?? ""}`);
  return parts.length ? `${warning}. ${parts.join("; ")}.` : warning;
}

function AddModal({ org, m, parent: initial, onClose, onDone }: { org: Org; m: MenuData; parent: Parent; onClose: () => void; onDone: () => Promise<unknown> }) {
  const [place, setPlace] = useState(initial ?? "top");
  const parent = toParent(place);
  const [mode, setMode] = useState<"existing" | "treatment" | "group">("existing");
  const [existing, setExisting] = useState("");
  const [name, setName] = useState("");
  const [dur, setDur] = useState("30");
  const [icon, setIcon] = useState<string | null>(null);
  const groupAllowed = canAddGroup(m, parent, org.menuMaxDepth);
  const here = new Set(children(m, parent).filter((x) => x.kind === "treatment").map((x) => x.id));
  const save = useMutation({
    mutationFn: async () => {
      if (mode === "existing") return addPlacement(org, existing, parent);
      if (mode === "treatment") return createMenuTreatment(org, parent, { name_nl: name.trim(), duration_min: Number(dur), icon });
      return createGroup(org, parent, { name_nl: name.trim(), icon });
    },
    onSuccess: async () => { await onDone(); toast.success("Toegevoegd"); onClose(); },
    onError: (e) => toast.error(errorText(e)),
  });
  const ready = mode === "existing" ? !!existing : !!name.trim() && (mode !== "group" || groupAllowed);
  const choices: Array<{ key: typeof mode; label: string; disabled?: string }> = [
    { key: "existing", label: "Bestaande behandeling" },
    { key: "treatment", label: "Nieuwe behandeling" },
    { key: "group", label: "Nieuwe groep", ...(groupAllowed ? {} : { disabled: `Kan niet: maximaal ${org.menuMaxDepth === 3 ? "drie" : org.menuMaxDepth} lagen groepen` }) },
  ];
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Toevoegen"
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!ready || save.isPending} onClick={() => save.mutate()}>Toevoegen</PillButton></>}>
      <div className="flex flex-col gap-5">
        <Select label="Plek in het menu" value={place} onChange={(v) => { setPlace(v || "top"); setExisting(""); }} options={placeOptions(org, m)} preserveOrder />
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Wat wil je toevoegen?">
          {choices.map((c) => (
            <button key={c.key} type="button" role="radio" aria-checked={mode === c.key} disabled={!!c.disabled} onClick={() => setMode(c.key)}
              className={cn("flex min-h-12 flex-col justify-center rounded-[14px] px-4 text-left text-sm disabled:cursor-not-allowed", mode === c.key ? "bg-teal-light text-primary" : "bg-sand hover:bg-mist", c.disabled && "opacity-60 hover:bg-sand")}>
              <span>{c.label}</span>
              {c.disabled && <span className="text-xs text-warning">{c.disabled}</span>}
            </button>
          ))}
        </div>
        {mode === "existing" && (
          <SearchablePicker label="Behandeling" value={existing} onChange={(v) => setExisting(v[0] ?? "")}
            options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl, group: "", ...(here.has(t.id) ? { disabled: true, reason: "Staat hier al" } : {}) }))} />
        )}
        {mode !== "existing" && <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />}
        {mode === "treatment" && <Select label="Duur" value={dur} onChange={setDur} options={durationOptions().map((d) => ({ value: String(d), label: `${d} minuten` }))} />}
        {mode !== "existing" && <IconField org={org} m={m} own={icon} parent={parent} onChange={setIcon} onDone={onDone} />}
      </div>
    </Modal>
  );
}

/** The real booking-flow look: what the patient sees for the selected level. */
function PhonePreview({ org, m, sel, onGroup }: { org: Org; m: MenuData; sel: Parent; onGroup: (id: Parent) => void }) {
  const [treatment, setTreatment] = useState<string | null>(null);
  const [history, setHistory] = useState<Parent[]>([]);
  // Same rule as /boeken: offered at an open location.
  const offeredOpen = (id: string) => org.treatmentLocations.filter((x) => x.treatment_id === id && org.locations.some((l) => l.id === x.location_id && l.status === "open")).map((x) => x.location_id);
  const visible = (id: string) => {
    const t = org.treatments.find((x) => x.id === id);
    return !!t && t.status === "active" && t.online_booking === "bookable" && offeredOpen(id).length > 0;
  };
  const label = (key: string) => org.options.find((o) => o.list_key === "booking_ui" && o.value === key)?.label_nl ?? "";
  const items = visibleChildren(m, sel, visible);
  const groupIcon = (id: string) => org.categories.find((c) => c.id === id)?.icon;
  const icon = (own: string | null | undefined, parent: Parent) => resolveIcon({ ...m, groupIcon }, own, parent, org.menuDefaultIcon).icon;
  const t = treatment ? org.treatments.find((x) => x.id === treatment) : null;
  const goBack = () => {
    if (treatment) return setTreatment(null);
    const prev = history[history.length - 1];
    setHistory(history.slice(0, -1));
    onGroup(prev !== undefined ? prev : (sel ? org.categories.find((c) => c.id === sel)?.parent_id ?? null : null));
  };
  const top = sel === null && !treatment;
  return (
    <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[32px] bg-background shadow-[0_8px_24px_rgba(57,51,46,0.10)]" aria-label="Voorbeeld voor de patiënt">
      <header className="grid h-14 grid-cols-[48px_1fr_48px] items-center px-2">
        {top ? <span className="text-center text-[13px] font-semibold text-primary">EN</span>
          : <button type="button" onClick={goBack} aria-label="Terug" className="flex justify-center"><img src="/ui-icons/pijl-links.svg" alt="" className="size-5" /></button>}
        <span className="text-center text-sm font-semibold">The Body Clinic</span>
        <span className="flex justify-center"><img src="/ui-icons/kruis.svg" alt="" className="size-5" /></span>
      </header>
      <div className="h-[3px] bg-muted"><div className="h-full bg-primary" style={{ width: t ? "30%" : top ? "10%" : "15%" }} /></div>
      <div className="max-h-[calc(100dvh-200px)] min-h-[480px] overflow-y-auto px-5 pb-6 pt-7">
        {t ? (
          <>
            <h3 className="mb-6 text-[24px] font-semibold leading-[1.2] tracking-tight">{label("q_location")}</h3>
            <div className="flex flex-col gap-2">
              {[...org.locations].filter((l) => offeredOpen(t.id).includes(l.id)).sort((a, z) => Number(z.kind === "online") - Number(a.kind === "online") || a.sort - z.sort).map((l) => { return (
                <div key={l.id} className="flex min-h-[56px] items-center gap-3 rounded-[16px] bg-sand px-4 text-[15px]"><img src={l?.kind === "online" ? "/ui-icons/videogesprek.svg" : "/ui-icons/locatie.svg"} alt="" className="size-5" />{l?.name}</div>
              ); })}
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-6 text-[24px] font-semibold leading-[1.2] tracking-tight">{sel ? org.categories.find((c) => c.id === sel)?.name_nl : label("q_category")}</h3>
            <div className="flex flex-col gap-2">
              {items.map((it) => {
                const g = it.kind === "group" ? org.categories.find((c) => c.id === it.id) : null;
                const tr = it.kind === "treatment" ? org.treatments.find((x) => x.id === it.id) : null;
                return (
                  <button key={`${it.kind}:${it.id}`} type="button" className="patient-choice flex min-h-[56px] items-center gap-3 rounded-[16px] bg-sand px-4 text-left"
                    onClick={() => { if (g) { setHistory([...history, sel]); onGroup(g.id); } else if (tr) setTreatment(tr.id); }}>
                    <span className="flex size-8 shrink-0 items-center justify-center"><MenuIcon icon={g ? icon(g.icon, g.parent_id) : icon(tr?.icon, sel)} /></span>
                    <span className="min-w-0 flex-1 py-2.5"><span className="block break-words text-[15px]">{g?.name_nl ?? tr?.name_nl}</span>{tr && <span className="block text-[12px] text-muted-foreground">{tr.duration_min} min</span>}</span>
                    <img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4 shrink-0" />
                  </button>
                );
              })}
              {items.length === 0 && <p className="text-sm text-muted-foreground">Hier ziet de patiënt niets.</p>}
            </div>
          </>
        )}
      </div>
      {top && (
        <footer className="flex items-center justify-center gap-3 px-5 pb-6">
          <img src={joyceAsset.url} alt="" className="size-11 shrink-0 rounded-full object-cover" style={{ objectPosition: "50% 18%" }} />
          <span className="text-[13px] text-muted-foreground"><span className="block">{label("call")} <span className="text-primary underline">{org.clinicPhone}</span></span><span className="block">{label("call_team")}</span></span>
        </footer>
      )}
    </div>
  );
}
