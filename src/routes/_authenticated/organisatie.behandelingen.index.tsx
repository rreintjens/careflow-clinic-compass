import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { PlusIcon, SearchField, StatusMark, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import {
  createTreatment, generalDefaultsQuery, mainCategories, opts, orgQuery, saveCategory, saveCategoryOrder, saveTreatmentOrder, subCategories,
  type Category, type Org,
} from "@/data/organisation";
import { durationOptions } from "@/domain/organisation";
import { offeredSummary, treatmentBookability } from "@/features/organisation/bookability";
import { EquipmentKindsModal } from "@/features/organisation/EquipmentKindsModal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/behandelingen/")({
  head: () => ({ meta: [{ title: "Behandelingen · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(orgQuery), context.queryClient.ensureQueryData(generalDefaultsQuery)]),
  component: TreatmentsPage,
});

const CATEGORY_ICONS = ["botox", "fillers", "medisch-afvallen", "skinboosters", "huidtherapie", "lasertherapie", "huidverstrakking", "ooglidcorrectie"];

function DragHandle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0 text-muted-foreground">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.3" />))}
    </svg>
  );
}

function reorder<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [m] = next.splice(from, 1);
  if (m !== undefined) next.splice(to, 0, m);
  return next;
}

function TreatmentsPage() {
  const { data: org } = useSuspenseQuery(orgQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const mains = mainCategories(org);
  const [sel, setSel] = useState<string | null>(mains.find((c) => c.name_nl === "Lasertherapie")?.id ?? mains[0]?.id ?? null);
  const [subSel, setSubSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<{ list: string; index: number } | null>(null);
  const [catModal, setCatModal] = useState<Category | "new" | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [kindsOpen, setKindsOpen] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });

  const countFor = (catId: string) => {
    const ids = new Set([catId, ...subCategories(org, catId).map((s) => s.id)]);
    return new Set(org.categoryLinks.filter((l) => ids.has(l.category_id)).map((l) => l.treatment_id)).size;
  };

  const order = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: refresh,
    onError: () => toast.error("Volgorde opslaan is niet gelukt"),
  });

  const selected = mains.find((c) => c.id === sel) ?? null;
  const groups = useMemo(() => buildGroups(org, sel, subSel, q), [org, sel, subSel, q]);
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Behandelingen"
        description="Links de categorieën met hun subcategorieën, rechts de behandelingen per subcategorie. Een behandeling kan in meer categorieën en subcategorieën staan."
        actions={<PillButton variant="outline" onClick={() => setKindsOpen(true)}>Soorten apparatuur</PillButton>}
      />
      {kindsOpen && <EquipmentKindsModal org={org} onClose={() => setKindsOpen(false)} />}
      <div className="grid grid-cols-[360px_minmax(0,1fr)] items-start gap-6">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Categorieën</h2>
            <PillButton variant="outline" onClick={() => setCatModal("new")}><PlusIcon />Nieuwe categorie</PillButton>
          </div>
          <button
            type="button"
            onClick={() => { setSel(null); setSubSel(null); }}
            className={cn("flex h-12 w-full items-center justify-between rounded-xl px-2 text-sm", sel === null && "bg-teal-light text-primary")}
          >
            <span>Alle behandelingen</span>
            <span className="text-xs text-muted-foreground">{org.treatments.length}</span>
          </button>
          <ul className="flex flex-col">
            {mains.map((c, i) => (
              <li key={c.id}>
                <div
                  draggable
                  onDragStart={() => setDrag({ list: "cats", index: i })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (drag?.list !== "cats" || drag.index === i) return;
                    const ids = reorder(mains.map((m) => m.id), drag.index, i);
                    setDrag(null);
                    order.mutate(() => saveCategoryOrder(ids));
                  }}
                  className={cn("flex h-[52px] items-center gap-3 rounded-xl px-2", sel === c.id && "bg-teal-light")}
                >
                  <DragHandle />
                  {c.icon ? <img src={`/treatment-icons/${c.icon}.png`} alt="" className="h-7 w-7" /> : <span className="h-7 w-7" />}
                  <button type="button" onClick={() => { setSel(c.id); setSubSel(null); }} className={cn("flex-1 truncate text-left text-sm", sel === c.id && "text-primary")}>
                    {c.name_nl}
                  </button>
                  <span className="text-xs text-muted-foreground">{countFor(c.id)}</span>
                  <button type="button" onClick={() => setCatModal(c)} className="text-[13px] text-primary hover:text-primary-hover">Wijzig</button>
                </div>
                {sel === c.id && (
                  <ul className="flex flex-col py-1 pl-11">
                    {subCategories(org, c.id).map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => setSubSel(subSel === s.id ? null : s.id)}
                          className={cn("flex h-10 w-full items-center justify-between rounded-lg px-2 text-[13px]", subSel === s.id && "bg-sand text-primary")}
                        >
                          <span>{s.name_nl}</span>
                          <span className="text-xs text-muted-foreground">{countFor(s.id)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-[1.5] text-muted-foreground">
            Deze volgorde is ook de volgorde in de boekingsflow. Sleep om die te wijzigen. Klik een subcategorie om alleen die te zien.
          </p>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold">
            {selected?.name_nl ?? "Alle behandelingen"} <span className="font-normal text-muted-foreground">· {total} behandelingen</span>
          </h2>
          <div className="mt-4 flex items-center gap-3">
            <SearchField placeholder="Zoek een behandeling" value={q} onChange={(e) => setQ(e.target.value)} className="w-[230px]" aria-label="Zoek een behandeling" />
            <PillButton variant="outline" onClick={() => setNewOpen(true)}><PlusIcon />Nieuwe behandeling</PillButton>
          </div>
          <div className="mt-5 overflow-x-auto">
            <div className="grid min-w-[640px] grid-cols-[28px_minmax(0,1fr)_230px_110px_60px] gap-x-2 px-1 pb-2 text-xs text-muted-foreground">
              <span /><span className="pl-10">Behandeling</span><span>Duur · aangeboden · behandelaars</span><span>Boekbaar</span><span />
            </div>
            {groups.map((g) => (
              <div key={g.key} className="min-w-[640px]">
                {g.label && (
                  <div className="px-1 pb-1 pt-4 text-[13px] font-semibold text-primary">
                    {g.label} <span className="font-normal text-muted-foreground">· {g.items.length}</span>
                  </div>
                )}
                {g.items.map((t, i) => (
                  <div
                    key={t.id}
                    draggable={!!g.categoryId}
                    onDragStart={() => setDrag({ list: g.key, index: i })}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!g.categoryId || drag?.list !== g.key || drag.index === i) return;
                      const ids = reorder(g.items.map((x) => x.id), drag.index, i);
                      setDrag(null);
                      const cat = g.categoryId;
                      order.mutate(() => saveTreatmentOrder(cat, ids));
                    }}
                    className="grid grid-cols-[28px_minmax(0,1fr)_230px_110px_60px] items-center gap-x-2 rounded-xl px-1 py-2.5 hover:bg-sand/60"
                  >
                    <DragHandle />
                    <div className="flex min-w-0 items-center gap-3">
                      {t.icon ? <img src={`/treatment-icons/${t.icon}.png`} alt="" className="h-7 w-7 shrink-0" /> : <span className="h-7 w-7 shrink-0" />}
                      <div className="min-w-0">
                        <div className="truncate text-sm">{t.name}</div>
                        {t.alsoIn && <div className="truncate text-xs text-primary">Ook in {t.alsoIn}</div>}
                      </div>
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">{t.meta}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap text-[13px]">
                      <StatusMark kind={t.ok === t.total && t.total > 0 ? "ok" : "warn"} />
                      {t.ok} van {t.total}
                    </span>
                    <Link to="/organisatie/behandelingen/$id" params={{ id: t.id }} className="text-[13px] text-primary hover:text-primary-hover">Wijzig</Link>
                  </div>
                ))}
              </div>
            ))}
            {total === 0 && <p className="py-6 text-sm text-muted-foreground">Geen behandelingen gevonden.</p>}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Deze volgorde is ook de volgorde binnen de categorie in de boekingsflow. Sleep om die te wijzigen.</p>
        </Card>
      </div>

      {catModal && <CategoryModal org={org} category={catModal === "new" ? null : catModal} onClose={() => setCatModal(null)} onSaved={refresh} />}
      {newOpen && (
        <NewTreatmentModal
          org={org}
          defaultCategory={subSel ?? (sel ? subCategories(org, sel)[0]?.id ?? sel : null)}
          onClose={() => setNewOpen(false)}
          onCreated={async (id) => {
            await refresh();
            void navigate({ to: "/organisatie/behandelingen/$id", params: { id } });
          }}
        />
      )}
    </div>
  );
}

interface Row { id: string; name: string; icon: string | null; meta: string; ok: number; total: number; alsoIn: string | null }

function buildGroups(org: Org, sel: string | null, subSel: string | null, q: string) {
  const needle = q.trim().toLowerCase();
  const row = (tid: string, ownMain: string | null): Row | null => {
    const t = org.treatments.find((x) => x.id === tid);
    if (!t || (needle && !t.name_nl.toLowerCase().includes(needle))) return null;
    const b = treatmentBookability(org, tid);
    const otherMains = org.categoryLinks
      .filter((l) => l.treatment_id === tid)
      .map((l) => org.categories.find((c) => c.id === l.category_id))
      .map((c) => (c?.parent_id ? org.categories.find((p) => p.id === c.parent_id) : c))
      .filter((c): c is Category => !!c && c.id !== ownMain);
    return {
      id: tid,
      name: t.name_nl,
      icon: t.icon,
      meta: `${t.duration_min} min · ${offeredSummary(org, b.offered)} · ${b.practitionerCount} behandelaars`,
      ok: b.ok,
      total: b.total,
      alsoIn: ownMain && otherMains.length ? [...new Set(otherMains.map((c) => c.name_nl))].join(", ") : null,
    };
  };
  if (!sel) {
    const items = org.treatments.map((t) => row(t.id, null)).filter((r): r is Row => !!r);
    return [{ key: "all", label: null as string | null, categoryId: null as string | null, items }];
  }
  const subs = subCategories(org, sel).filter((s) => !subSel || s.id === subSel);
  const lists = subs.length ? subs : [org.categories.find((c) => c.id === sel) as Category];
  return lists.map((s) => ({
    key: s.id,
    label: subs.length ? s.name_nl : null,
    categoryId: s.id as string | null,
    items: org.categoryLinks
      .filter((l) => l.category_id === s.id)
      .sort((a, b) => a.sort - b.sort)
      .map((l) => row(l.treatment_id, sel))
      .filter((r): r is Row => !!r),
  })).filter((g) => g.items.length || !needle);
}

function CategoryModal({ org, category, onClose, onSaved }: { org: Org; category: Category | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const { data: defaults } = useSuspenseQuery(generalDefaultsQuery);
  const existingSubs = category ? subCategories(org, category.id) : [];
  const [name, setName] = useState(category?.name_nl ?? "");
  const [nameEn, setNameEn] = useState(category?.name_en ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "none");
  const [cancel, setCancel] = useState(category?.cancel_until_hours != null ? String(category.cancel_until_hours) : "default");
  const [fee, setFee] = useState(category?.no_show_fee_eur != null ? String(category.no_show_fee_eur) : "default");
  const [subs, setSubs] = useState(existingSubs.map((s) => ({ id: s.id as string | null, name_nl: s.name_nl })));
  const save = useMutation({
    mutationFn: () =>
      saveCategory(
        category?.id ?? null,
        {
          name_nl: name.trim(),
          name_en: nameEn.trim() || null,
          icon: icon === "none" ? null : icon,
          cancel_until_hours: cancel === "default" ? null : Number(cancel),
          no_show_fee_eur: fee === "default" ? null : Number(fee),
          sort: category?.sort ?? mainCategories(org).length,
        },
        subs.filter((s) => s.name_nl.trim()),
        existingSubs.map((s) => s.id),
      ),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={category ? category.name_nl : "Nieuwe categorie"}
      description="Naam, icoon en subcategorieën. De volgorde van de subcategorieën is ook de volgorde in de boekingsflow."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="Naam (Engels)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} help="Leeg laten: de patiënt ziet de Nederlandse naam." />
        <Select label="Icoon" value={icon} onChange={setIcon} options={[{ value: "none", label: "Geen icoon" }, ...CATEGORY_ICONS.map((i) => ({ value: i, label: i.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }))]} />
        <div className="flex items-end">{icon !== "none" && <img src={`/treatment-icons/${icon}.png`} alt="" className="h-12 w-12" />}</div>
        <Select label="Verzetten en annuleren tot" value={cancel} onChange={setCancel} options={[{ value: "default", label: `Standaard uit Algemeen (${defaults.cancelHours} uur)` }, ...opts(org, "cancel_until_hours")]} />
        <Select label="No-showbedrag" value={fee} onChange={setFee} options={[{ value: "default", label: `Standaard uit Algemeen (${defaults.noShowCents ? `€${defaults.noShowCents / 100}` : "geen"})` }, ...opts(org, "no_show_fee_eur")]} />
      </div>
      <div className="mt-5 flex flex-col gap-2">
        <span className="text-[13px] font-medium">Subcategorieën</span>
        {subs.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="flex items-center gap-2">
            <input aria-label="Subcategorie" className="h-11 flex-1 rounded-[14px] bg-sand px-4 text-sm outline-none" value={s.name_nl} onChange={(e) => setSubs(subs.map((x, j) => (j === i ? { ...x, name_nl: e.target.value } : x)))} />
            <button type="button" className="text-sm text-warning underline" onClick={() => setSubs(subs.filter((_, j) => j !== i))}>Verwijderen</button>
          </div>
        ))}
        <div><PillButton variant="outline" onClick={() => setSubs([...subs, { id: null, name_nl: "" }])}><PlusIcon />Subcategorie toevoegen</PillButton></div>
      </div>
    </Modal>
  );
}

function NewTreatmentModal({ org, defaultCategory, onClose, onCreated }: { org: Org; defaultCategory: string | null; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [dur, setDur] = useState("30");
  const catOptions = mainCategories(org).flatMap((m) => {
    const subs = subCategories(org, m.id);
    return subs.length ? subs.map((s) => ({ value: s.id, label: `${m.name_nl} · ${s.name_nl}` })) : [{ value: m.id, label: m.name_nl }];
  });
  const [cat, setCat] = useState(defaultCategory && catOptions.some((o) => o.value === defaultCategory) ? defaultCategory : catOptions[0]?.value ?? "");
  const create = useMutation({
    mutationFn: () => createTreatment({ name_nl: name.trim(), duration_min: Number(dur), categoryId: cat }),
    onSuccess: async (id) => { toast.success("Behandeling aangemaakt"); onClose(); await onCreated(id); },
    onError: () => toast.error("Aanmaken is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title="Nieuwe behandeling"
      description="Daarna vul je op de pagina van de behandeling de rest in."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!name.trim() || !cat || create.isPending} onClick={() => create.mutate()}>Aanmaken</PillButton></>}
    >
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} className="col-span-2" />
        <Select label="Duur" value={dur} onChange={setDur} options={durationOptions().map((d) => ({ value: String(d), label: `${d} minuten` }))} help="In stappen van 5 minuten." />
        <Select label="Categorie" value={cat} onChange={setCat} options={catOptions} />
      </div>
    </Modal>
  );
}
