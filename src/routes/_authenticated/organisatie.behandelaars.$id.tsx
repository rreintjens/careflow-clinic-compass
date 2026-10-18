import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Checkbox, Chip, PlusIcon, SearchField, StatusMark, Tag, TextArea, TextField, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import {
  addTreatmentsToPractitioner, fullName, locName, mainCategories, offeredLocationIds, optLabel, opts, orgQuery, removePractitionerTreatment,
  roleName, savePractitioner, setPractitionerTreatmentExclusions, subCategories, treatmentMainCategoryIds, uploadPractitionerPhoto, workLocationIds,
  type Org,
} from "@/data/organisation";
import { practitionerExcludedHere, practitionerTreatmentLocations } from "@/domain/organisation";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/behandelaars/$id")({
  head: () => ({ meta: [{ title: "Behandelaar · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context, params }) => {
    const org = await context.queryClient.ensureQueryData(orgQuery);
    if (!org.practitioners.some((p) => p.id === params.id)) throw notFound();
  },
  component: PractitionerPage,
});

function PractitionerPage() {
  const { id } = Route.useParams();
  const { data: org } = useSuspenseQuery(orgQuery);
  const p = org.practitioners.find((x) => x.id === id);
  if (!p) return null;
  return <PractitionerForm key={`${p.id}-${p.updated_at}`} org={org} />;
}

function PractitionerForm({ org }: { org: Org }) {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const p = org.practitioners.find((x) => x.id === id);
  if (!p) throw new Error("practitioner missing");
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });
  const [first, setFirst] = useState(p.first_name);
  const [last, setLast] = useState(p.last_name);
  const [role, setRole] = useState(p.role_id);
  const [status, setStatus] = useState(p.status);
  const [langs, setLangs] = useState(org.practitionerLanguages.filter((l) => l.practitioner_id === id).map((l) => l.language_code));
  const [bio, setBio] = useState(p.bio_nl ?? "");
  const [bioEn, setBioEn] = useState(p.bio_en ?? "");
  const [locs, setLocs] = useState(workLocationIds(org, id));
  const [langOpen, setLangOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editT, setEditT] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const account = useQuery({
    queryKey: ["practitioner-account", p.user_id],
    enabled: !!p.user_id,
    queryFn: async () => {
      const [prof, ur] = await Promise.all([
        supabase.from("profiles").select("email").eq("id", p.user_id as string).maybeSingle(),
        supabase.from("tenant_memberships").select("roles(name)").eq("user_id", p.user_id as string).eq("tenant_id", p.tenant_id).maybeSingle(),
      ]);
      const roleRow = ur.data?.roles as { name: string } | null | undefined;
      return { email: prof.data?.email ?? null, role: roleRow?.name ?? null };
    },
  });

  const save = useMutation({
    mutationFn: () =>
      savePractitioner(org, id, { first_name: first.trim(), last_name: last.trim(), role_id: role, status, bio_nl: bio.trim() || null, bio_en: bioEn.trim() || null }, { languageCodes: langs, locationIds: locs }),
    onSuccess: async () => { await refresh(); toast.success("Opgeslagen"); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const upload = useMutation({
    mutationFn: (f: File) => uploadPractitionerPhoto(id, f),
    onSuccess: async () => { await refresh(); toast.success("Foto gewijzigd"); },
    onError: () => toast.error("Foto uploaden is niet gelukt"),
  });
  const canSave = first.trim() && last.trim() && bio.length <= 80 && bioEn.length <= 80 && !save.isPending;

  const myTreatments = org.practitionerTreatments.filter((pt) => pt.practitioner_id === id);
  const rows = myTreatments
    .map((pt) => {
      const t = org.treatments.find((x) => x.id === pt.treatment_id);
      if (!t) return null;
      const offered = offeredLocationIds(org, t.id);
      return {
        t, pt, offered,
        here: practitionerTreatmentLocations(locs, offered, pt.excluded_location_ids),
        notHere: practitionerExcludedHere(locs, offered, pt.excluded_location_ids),
        cats: treatmentMainCategoryIds(org, t.id).map((c) => org.categories.find((x) => x.id === c)?.name_nl).join(", "),
      };
    })
    .filter((r): r is NonNullable<typeof r> => !!r);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/organisatie/behandelaars" className="text-sm text-primary hover:text-primary-hover">Behandelaars</Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight">{fullName(p)}</h1>
            <Tag>{roleName(org, p.role_id)}</Tag>
            <Tag tone="sand">{optLabel(org, "practitioner_status", p.status)}</Tag>
          </div>
          <PillButton size="lg" disabled={!canSave} onClick={() => save.mutate()}>Opslaan</PillButton>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Profiel voor patiënten" description="Dit zien patiënten bij het kiezen van een behandelaar en in de bevestigingsmail.">
            <div className="flex gap-6">
              <div className="flex flex-col items-center gap-2">
                <Avatar path={p.photo_path} size={96} />
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = ""; }} />
                <TextLink onClick={() => fileRef.current?.click()}>Foto wijzigen</TextLink>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4">
                <TextField label="Voornaam" value={first} onChange={(e) => setFirst(e.target.value)} />
                <TextField label="Achternaam" value={last} onChange={(e) => setLast(e.target.value)} />
                <div className="col-span-2 flex flex-col gap-2">
                  <span className="text-[13px] font-medium">Talen</span>
                  <div className="flex flex-wrap gap-2">
                    {langs.map((c) => (
                      <span key={c} className="inline-flex h-10 items-center gap-2 rounded-full bg-sand px-4 text-sm">
                        {org.languages.find((l) => l.code === c)?.name_nl}
                        <button type="button" aria-label="Taal verwijderen" onClick={() => setLangs(langs.filter((x) => x !== c))} className="text-muted-foreground">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                        </button>
                      </span>
                    ))}
                    <button type="button" onClick={() => setLangOpen(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-primary px-4 text-sm text-primary"><PlusIcon />Taal</button>
                  </div>
                </div>
                <TextArea label="Korte bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={80} help="Maximaal 80 tekens." className="col-span-2" />
                <TextArea label="Korte bio (Engels)" value={bioEn} onChange={(e) => setBioEn(e.target.value)} maxLength={80} help="Leeg laten: de patiënt ziet de Nederlandse bio." className="col-span-2" />
                <Select label="Rol" value={role} onChange={setRole} options={org.roles.map((r) => ({ value: r.id, label: r.name_nl }))} />
                <Select label="Status" value={status} onChange={setStatus} options={opts(org, "practitioner_status")} />
              </div>
            </div>
          </Card>

          <Card title="Werklocaties" description={`Het rooster kan ${p.first_name} alleen op deze locaties inplannen.`}>
            <div className="flex flex-wrap gap-2">
              {org.locations.map((l) => <Chip key={l.id} selected={locs.includes(l.id)} onClick={() => setLocs(locs.includes(l.id) ? locs.filter((x) => x !== l.id) : [...locs, l.id])}>{l.name}</Chip>)}
            </div>
          </Card>

          <Card title="Behandelingen, en waar ze die doet" description={`Klik op een behandeling om aan te passen op welke werklocaties ${p.first_name} die doet.`}>
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.t.id} className="flex items-center gap-3 py-3">
                  <div className="w-[240px] min-w-0">
                    <div className="truncate text-sm">{r.t.name_nl}</div>
                    <div className="truncate text-xs text-muted-foreground">{r.cats}</div>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {r.here.map((l) => <Tag key={l}>{locName(org, l)}</Tag>)}
                    {r.here.length === 0 && <span className="text-xs text-warning">Werkt niet waar dit wordt aangeboden</span>}
                    {r.notHere.length > 0 && <span className="text-xs text-muted-foreground">Niet in {r.notHere.map((l) => locName(org, l)).join(", ")}</span>}
                  </div>
                  <button type="button" onClick={() => setEditT(r.t.id)} className="text-[13px] text-primary hover:text-primary-hover">Wijzig</button>
                </li>
              ))}
            </ul>
            <div className="mt-4"><PillButton variant="outline" onClick={() => setAddOpen(true)}><PlusIcon />Behandelingen toevoegen</PillButton></div>
          </Card>

          <div className="flex gap-2">
            <PillButton size="lg" disabled={!canSave} onClick={() => save.mutate()}>Opslaan</PillButton>
            <PillButton size="lg" variant="outline" onClick={() => navigate({ to: "/organisatie/behandelaars" })}>Annuleren</PillButton>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <Card title={`Waar patiënten ${p.first_name} kunnen boeken`}>
            <ul className="divide-y divide-line">
              {rows.map((r) => {
                const notOffered = locs.filter((l) => !r.offered.includes(l));
                const parts = [r.here.length ? `${r.here.map((l) => locName(org, l)).join(" en ")}.` : "Nergens."];
                if (r.notHere.length) parts.push(`Niet in ${r.notHere.map((l) => locName(org, l)).join(", ")}: uitgezet bij deze behandeling.`);
                if (notOffered.length) parts.push(`${notOffered.map((l) => locName(org, l)).join(", ")} telt niet mee: daar wordt deze behandeling niet aangeboden.`);
                return (
                  <li key={r.t.id} className="flex gap-3 py-3">
                    <StatusMark kind={r.here.length ? "ok" : "warn"} />
                    <div><div className="text-sm">{r.t.name_nl}</div><div className="text-xs leading-[1.6] text-muted-foreground">{parts.join(" ")}</div></div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3"><Link to="/agenda/rooster" search={{ practitioner: p.id }} className="text-sm text-primary underline underline-offset-2">Rooster van {p.first_name} bekijken</Link></div>
          </Card>
          <Card title="Account">
            {p.user_id ? (
              <div className="flex flex-col gap-3 text-sm">
                <div><div className="text-xs text-muted-foreground">Gebruiker</div><div>{account.data?.email ?? p.email}</div></div>
                <div><div className="text-xs text-muted-foreground">Rol in het systeem</div><div>{account.data?.role ?? ""}</div></div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nog niet gekoppeld aan een gebruiker.</p>
            )}
            <div className="mt-3"><Link to="/instellingen/gebruikers-en-rollen" className="text-sm text-primary underline underline-offset-2">Naar gebruikers en rollen</Link></div>
          </Card>
        </div>
      </div>

      {langOpen && <LanguageModal org={org} current={langs} onClose={() => setLangOpen(false)} onPick={(c) => { setLangs([...langs, c]); setLangOpen(false); }} />}
      {addOpen && <AddTreatmentsModal org={org} practitionerId={id} onClose={() => setAddOpen(false)} onSaved={refresh} />}
      {editT && <TreatmentLocationsModal org={org} practitionerId={id} treatmentId={editT} workLocations={locs} onClose={() => setEditT(null)} onSaved={refresh} />}
    </div>
  );
}

function LanguageModal({ org, current, onClose, onPick }: { org: Org; current: string[]; onClose: () => void; onPick: (code: string) => void }) {
  const options = org.languages.filter((l) => !current.includes(l.code)).map((l) => ({ value: l.code, label: l.name_nl }));
  const [code, setCode] = useState(options[0]?.value ?? "");
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Taal toevoegen" footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!code} onClick={() => onPick(code)}>Toevoegen</PillButton></>}>
      <Select label="Taal" value={code} onChange={setCode} options={options} />
    </Modal>
  );
}

function AddTreatmentsModal({ org, practitionerId, onClose, onSaved }: { org: Org; practitionerId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const p = org.practitioners.find((x) => x.id === practitionerId);
  const done = new Set(org.practitionerTreatments.filter((x) => x.practitioner_id === practitionerId).map((x) => x.treatment_id));
  const roleTreatments = new Set(org.treatmentRoles.filter((r) => r.role_id === p?.role_id).map((r) => r.treatment_id));
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<string[]>(() => [...done]);
  const groups = mainCategories(org)
    .map((c) => {
      const ids = new Set([c.id, ...subCategories(org, c.id).map((s) => s.id)]);
      const tids = [...new Set(org.categoryLinks.filter((l) => ids.has(l.category_id)).map((l) => l.treatment_id))];
      const items = tids
        .map((tid) => org.treatments.find((t) => t.id === tid))
        .filter((t): t is NonNullable<typeof t> => !!t && roleTreatments.has(t.id) && (!q || t.name_nl.toLowerCase().includes(q.toLowerCase())));
      return { c, items };
    })
    .filter((g) => g.items.length);
  const add = useMutation({
    mutationFn: async () => {
      await addTreatmentsToPractitioner(practitionerId, adds);
      for (const t of removes) await removePractitionerTreatment(practitionerId, t);
    },
    onSuccess: async () => { await onSaved(); toast.success("Behandelingen opgeslagen"); onClose(); },
    onError: () => toast.error("Toevoegen is niet gelukt"),
  });
  const adds = picked.filter((x) => !done.has(x));
  const removes = [...done].filter((x) => !picked.includes(x));
  const changes = adds.length + removes.length;
  if (!p) return null;
  const toggle = (id: string, v: boolean) => setPicked(v ? [...new Set([...picked, id])] : picked.filter((x) => x !== id));
  return (
    <Modal
      open
      width="lg"
      onOpenChange={(o) => !o && onClose()}
      title={`Behandelingen toevoegen aan ${p.first_name}`}
      description={`Vink een hele categorie aan, of losse behandelingen. Je ziet de behandelingen die bij de rol ${roleName(org, p.role_id).toLowerCase()} horen.`}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="flex items-center gap-3 text-sm">{picked.length} behandelingen geselecteerd{removes.length ? ` · ${removes.length} uitgevinkt` : ""} <TextLink onClick={() => setPicked([])}>Wis selectie</TextLink></span>
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!changes || add.isPending} onClick={() => add.mutate()}>{removes.length ? `Opslaan (${changes})` : `Toevoegen (${adds.length})`}</PillButton></div>
        </div>
      }
    >
      <SearchField placeholder="Zoek een behandeling" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek een behandeling" />
      <div className="mt-4 flex flex-col gap-5">
        {groups.map(({ c, items }) => {
          const open = items;
          const all = open.length > 0 && open.every((t) => picked.includes(t.id));
          return (
            <div key={c.id}>
              <div className="flex items-center gap-3">
                <Checkbox checked={all} label={c.name_nl} disabled={!open.length} onChange={(v) => setPicked(v ? [...new Set([...picked, ...open.map((t) => t.id)])] : picked.filter((x) => !open.some((t) => t.id === x)))} />
                <span className="flex-1 text-sm font-semibold">{c.name_nl}</span>
                {open.length > 0 && (all
                  ? <button type="button" className="text-[13px] text-primary" onClick={() => setPicked(picked.filter((x) => !open.some((t) => t.id === x)))}>Niets uit deze categorie</button>
                  : <button type="button" className="text-[13px] text-primary" onClick={() => setPicked([...new Set([...picked, ...open.map((t) => t.id)])])}>Alle {open.length} selecteren</button>)}
              </div>
              <ul className="mt-2 flex flex-col gap-2 pl-7">
                {items.map((t) => {
                  const already = done.has(t.id);
                  const on = picked.includes(t.id);
                  return (
                    <li key={t.id} className={cn("flex items-center gap-3 rounded-[14px] px-3.5 py-3", on ? "border border-primary bg-teal-light" : "border border-line")}>
                      <Checkbox checked={on} label={t.name_nl} onChange={(v) => toggle(t.id, v)} />
                      <span className="flex-1 text-sm">{t.name_nl}</span>
                      <span className="text-xs text-muted-foreground">{already && !on ? "Wordt verwijderd" : already ? "Al toegevoegd" : `${t.duration_min} min`}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function TreatmentLocationsModal({ org, practitionerId, treatmentId, workLocations, onClose, onSaved }: { org: Org; practitionerId: string; treatmentId: string; workLocations: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = org.treatments.find((x) => x.id === treatmentId);
  const pt = org.practitionerTreatments.find((x) => x.practitioner_id === practitionerId && x.treatment_id === treatmentId);
  const candidates = practitionerTreatmentLocations(workLocations, offeredLocationIds(org, treatmentId), []);
  const [excluded, setExcluded] = useState(pt?.excluded_location_ids ?? []);
  const save = useMutation({
    mutationFn: () => setPractitionerTreatmentExclusions(practitionerId, treatmentId, excluded),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const remove = useMutation({
    mutationFn: () => removePractitionerTreatment(practitionerId, treatmentId),
    onSuccess: async () => { await onSaved(); toast.success("Verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  if (!t) return null;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={t.name_nl}
      description="Op welke werklocaties doet deze behandelaar deze behandeling? Alleen locaties waar de behandeling wordt aangeboden staan hier."
      footer={
        <div className="flex w-full items-center justify-between">
          <TextLink tone="warning" onClick={() => remove.mutate()}>Behandeling verwijderen</TextLink>
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        {candidates.map((l) => <Chip key={l} selected={!excluded.includes(l)} onClick={() => setExcluded(excluded.includes(l) ? excluded.filter((x) => x !== l) : [...excluded, l])}>{locName(org, l)}</Chip>)}
        {candidates.length === 0 && <p className="text-sm text-warning">Werkt niet waar dit wordt aangeboden.</p>}
      </div>
    </Modal>
  );
}
