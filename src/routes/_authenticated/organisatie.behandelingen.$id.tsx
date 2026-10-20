import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { rowOpen, RowChevron } from "@/components/ListPage";
import { Checkbox, Chip, PlusIcon, SearchField, StatusMark, Tag, TextArea, TextField, TextLink, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { StartScreenEditor } from "@/features/questionnaire/StartScreenEditor";
import { readStartScreen } from "@/domain/start-screen";
import { Select } from "@/components/Select";
import {
  addPractitionersToTreatment, deleteRequirement, fullName, generalDefaultsQuery, locName, mainCategories, offeredLocationIds, optLabel, opts,
  orgQuery, removePractitionerTreatment, roleName, saveRequirement, saveTreatment, setPractitionerTreatmentExclusions, subCategories,
  treatmentMainCategoryIds, workLocationIds, type Org, type Requirement, kindName, kindOpts,
} from "@/data/organisation";
import { durationOptions, practitionerExcludedHere, practitionerTreatmentLocations, TREATMENT_ICONS } from "@/domain/organisation";
import { REASON_TEXT, treatmentBookability } from "@/features/organisation/bookability";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/organisatie/behandelingen/$id")({
  head: () => ({ meta: [{ title: "Behandeling · Beheer · The Body Clinic" }, { name: "description", content: "Behandeling bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Behandeling · Beheer · The Body Clinic" }, { property: "og:description", content: "Behandeling bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context, params }) => {
    const [org] = await Promise.all([context.queryClient.ensureQueryData(orgQuery), context.queryClient.ensureQueryData(generalDefaultsQuery)]);
    if (!org.treatments.some((t) => t.id === params.id)) throw notFound();
  },
  component: TreatmentPage,
});

// Mail moments that use treatment fields (templates themselves are built in phase 6).
const MAIL_MOMENTS = [
  "Bevestiging, met {voorbereiding}",
  "Herinnering medische vragenlijst",
  "Herinnering afspraak, met {voorbereiding}",
  "Verzet, geannuleerd, niet verschenen",
  "Bedankt en vervolg, met {nazorg}",
];

function TreatmentPage() {
  const { id } = Route.useParams();
  const { data: org } = useSuspenseQuery(orgQuery);
  const { data: defaults } = useSuspenseQuery(generalDefaultsQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const t = org.treatments.find((x) => x.id === id);
  if (!t) return null;
  return <TreatmentForm key={`${t.id}-${t.updated_at}`} org={org} defaults={defaults} onSaved={() => qc.invalidateQueries({ queryKey: orgQuery.queryKey })} onCancel={() => navigate({ to: "/organisatie/behandelingen" })} />;
}

function TreatmentForm({ org, defaults, onSaved, onCancel }: { org: Org; defaults: { cancelHours: number; noShowCents: number }; onSaved: () => Promise<void>; onCancel: () => void }) {
  const { id } = Route.useParams();
  const t = org.treatments.find((x) => x.id === id);
  if (!t) throw new Error("treatment missing");
  const catLinkIds = org.categoryLinks.filter((l) => l.treatment_id === id).map((l) => l.category_id);
  const [name, setName] = useState(t.name_nl);
  const [nameEn, setNameEn] = useState(t.name_en ?? "");
  const [cats, setCats] = useState(catLinkIds);
  const [dur, setDur] = useState(String(t.duration_min));
  const [roles, setRoles] = useState(org.treatmentRoles.filter((r) => r.treatment_id === id).map((r) => r.role_id));
  const [choice, setChoice] = useState(t.practitioner_choice);
  const [cancel, setCancel] = useState(t.cancel_until_hours != null ? String(t.cancel_until_hours) : "default");
  const [fee, setFee] = useState(t.no_show_fee_eur != null ? String(t.no_show_fee_eur) : "default");
  const [status, setStatus] = useState(t.status);
  const [icon, setIcon] = useState(t.icon ?? "none");
  const [locs, setLocs] = useState(offeredLocationIds(org, id));
  const [pre, setPre] = useState(t.pre_questionnaire_key ?? "none");
  const [post, setPost] = useState(t.post_questionnaire_key ?? "none");
  const [startScreen,setStartScreen]=useState(readStartScreen(t.start_screen));
  const [qmin, setQmin] = useState(String(t.questionnaire_minutes ?? 8));
  const ps = readPortalSettings(t.portal_settings);
  const [courseCount, setCourseCount] = useState(String(ps.course_count ?? 1));
  const [courseInterval, setCourseInterval] = useState(ps.course_interval ?? "");
  const [aftercareDays, setAftercareDays] = useState(String(ps.aftercare_days ?? 7));
  const [reminderWeeks, setReminderWeeks] = useState(String(ps.reminder_weeks ?? 0));
  const [lang, setLang] = useState<"nl" | "en">("nl");
  const [texts, setTexts] = useState({
    description_nl: t.description_nl ?? "", description_en: t.description_en ?? "",
    preparation_nl: t.preparation_nl ?? "", preparation_en: t.preparation_en ?? "",
    aftercare_nl: t.aftercare_nl ?? "", aftercare_en: t.aftercare_en ?? "",
  });
  const [addOpen, setAddOpen] = useState(false);
  const [editPrac, setEditPrac] = useState<string | null>(null);
  const [reqModal, setReqModal] = useState<Requirement | "new" | null>(null);

  const catOptions = mainCategories(org).flatMap((m) => {
    const subs = subCategories(org, m.id);
    return subs.length ? subs.map((s) => ({ value: s.id, label: subs.length > 1 ? `${m.name_nl} · ${s.name_nl}` : m.name_nl })) : [{ value: m.id, label: m.name_nl }];
  });
  const mainNames = treatmentMainCategoryIds(org, id).map((c) => org.categories.find((x) => x.id === c)?.name_nl ?? "");

  const save = useMutation({
    mutationFn: () =>
      saveTreatment(
        org,
        id,
        {
          name_nl: name.trim(),
          name_en: nameEn.trim() || null,
          duration_min: Number(dur),
          practitioner_choice: choice,
          cancel_until_hours: cancel === "default" ? null : Number(cancel),
          no_show_fee_eur: fee === "default" ? null : Number(fee),
          status,
          icon: icon === "none" ? null : icon,
          pre_questionnaire_key: pre === "none" ? null : pre,
          post_questionnaire_key: post === "none" ? null : post,
          start_screen:startScreen,
          questionnaire_minutes: Math.min(60, Math.max(1, Number(qmin) || 8)),
          portal_settings: { ...ps, course_count: Number(courseCount), course_interval: courseInterval.trim() || undefined, aftercare_days: Number(aftercareDays) as 3|7|14|30, reminder_weeks: Number(reminderWeeks) as 0|4|8|12|16|24 },
          ...Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, v.trim() || null])),
        },
        { categoryIds: cats, roleIds: roles, locationIds: locs },
      ),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const canSave = name.trim() && cats.length > 0 && !save.isPending;

  const bookability = treatmentBookability(org, id);
  const notOffered = org.locations.filter((l) => !bookability.offered.includes(l.id));
  const [showBookable, setShowBookable] = useState(false);

  const doers = org.practitionerTreatments.filter((pt) => pt.treatment_id === id);
  const [pq, setPq] = useState("");
  const [proleF, setProleF] = useState("all");
  const [plocF, setPlocF] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const offered = offeredLocationIds(org, id);
  const doerRows = doers
    .map((pt) => {
      const p = org.practitioners.find((x) => x.id === pt.practitioner_id);
      if (!p) return null;
      const work = workLocationIds(org, p.id);
      return { p, pt, here: practitionerTreatmentLocations(work, offered, pt.excluded_location_ids), notHere: practitionerExcludedHere(work, offered, pt.excluded_location_ids) };
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    .filter((r) => !pq || fullName(r.p).toLowerCase().includes(pq.toLowerCase()))
    .filter((r) => proleF === "all" || r.p.role_id === proleF)
    .filter((r) => plocF === "all" || r.here.includes(plocF));
  const visibleDoers = showAll ? doerRows : doerRows.slice(0, 8);

  const reqs = org.requirements.filter((r) => r.treatment_id === id);
  const textKey = (base: "description" | "preparation" | "aftercare") => `${base}_${lang}` as keyof typeof texts;

  const roleOptions = org.roles.map((r) => ({ value: r.id, label: r.name_nl }));
  const locationOptions = [{ value: "all", label: "Alle locaties" }, ...org.locations.filter((l) => l.kind === "clinic").map((l) => ({ value: l.id, label: l.name }))];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/organisatie/behandelingen" className="text-sm text-primary hover:text-primary-hover">Behandelingen</Link>
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[28px] font-semibold tracking-tight">{t.name_nl}</h1>
            {mainNames.map((n) => <Tag key={n}>{n}</Tag>)}
            <Tag tone="sand">{optLabel(org, "treatment_status", t.status)}</Tag>
          </div>
          <PillButton disabled={!canSave} onClick={() => save.mutate()}>Opslaan</PillButton>
        </div>
      </div>

      <section className="border-t border-line pt-5"><h2 className="mb-4 text-lg font-semibold">Startscherm in de boekingsflow</h2><StartScreenEditor value={startScreen} onChange={setStartScreen} defaultButton="Kies waar en wanneer"/></section>
      <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Algemeen">
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              <TextField label="Naam" value={name} onChange={(e) => setName(e.target.value)} />
              <MultiSelect label="Categorieën" options={catOptions} value={cats} onChange={setCats} help="De behandeling staat in elk van deze categorieën." />
              <Select label="Duur" value={dur} onChange={setDur} options={durationOptions().map((d) => ({ value: String(d), label: `${d} minuten` }))} help="In stappen van 5 minuten." />
              <MultiSelect label="Rol van de behandelaar" options={roleOptions} value={roles} onChange={setRoles} help="De patiënt ziet “Kies je behandelaar”, met de rol bij elke naam." />
              <Select label="Standaard keuze behandelaar" value={choice} onChange={setChoice} options={opts(org, "practitioner_choice")} help="Een boekingslink kan hiervan afwijken." />
              <Select label="Verzetten en annuleren tot" value={cancel} onChange={setCancel} options={[{ value: "default", label: `Standaard uit Algemeen (${defaults.cancelHours} uur)` }, ...opts(org, "cancel_until_hours")]} help="Overschrijft de standaard alleen voor deze behandeling." />
              <Select label="No-showbedrag" value={fee} onChange={setFee} options={[{ value: "default", label: `Standaard uit Algemeen (${defaults.noShowCents ? `€${defaults.noShowCents / 100}` : "geen"})` }, ...opts(org, "no_show_fee_eur")]} help="Bij te laat annuleren of niet verschijnen." />
              <Select label="Status" value={status} onChange={setStatus} options={opts(org, "treatment_status")} />
              <TextField label="Naam (Engels)" value={nameEn} onChange={(e) => setNameEn(e.target.value)} help="Leeg laten: de patiënt ziet de Nederlandse naam." />
              <Select label="Icoon" value={icon} onChange={setIcon} options={[{ value: "none", label: "Icoon van de categorie" }, ...TREATMENT_ICONS.map((i) => ({ value: i, label: i.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) }))]} help="Leeg: de patiënt ziet het icoon van de (sub)categorie." />
              <div className="flex items-end pb-1">{icon !== "none" && <img src={`/treatment-icons/${icon}.png`} alt="" className="h-11 w-11" />}</div>
            </div>
          </Card>

          <Card title="Waar wordt deze behandeling aangeboden?" description={`${locs.some((l) => org.locations.find((x) => x.id === l)?.kind === "online") ? "Online staat aan: deze behandeling kan ook op afstand." : "Online staat uit: deze behandeling kan niet op afstand."} Dezelfde keuze zie je terug op de pagina van elke locatie.`}>
            <MultiSelect label="Aangeboden op locaties" options={org.locations.map(l => ({value:l.id,label:l.name}))} value={locs} onChange={setLocs} />
          </Card>

          <Card title="Wie doet deze behandeling, en waar?" description="Klik op een behandelaar om de locaties aan te passen. Je ziet de locaties waar die werkt en waar deze behandeling wordt aangeboden.">
            <div className="grid grid-cols-[minmax(0,1fr)_200px_200px] gap-2">
              <SearchField placeholder="Zoek op naam" value={pq} onChange={(e) => setPq(e.target.value)} aria-label="Zoek op naam" />
              <Select label="Rol" value={proleF} onChange={setProleF} options={[{ value: "all", label: "Alle rollen" }, ...roleOptions]} className="[&>label]:sr-only" />
              <Select label="Locatie" value={plocF} onChange={setPlocF} options={locationOptions} className="[&>label]:sr-only" />
            </div>
            <p className="mt-4 text-xs text-muted-foreground">{doers.length} behandelaars doen {t.name_nl.toLowerCase()}</p>
            <ul className="mt-2 divide-y divide-line" onClick={rowOpen}>
              {visibleDoers.map(({ p, here, notHere }) => (
                <li key={p.id} data-list-row className="flex items-center gap-3 py-2.5">
                  <Avatar path={p.photo_path} size={36} />
                  <div className="w-[180px] min-w-0">
                    <div className="truncate text-sm">{fullName(p)}</div>
                    <div className="truncate text-xs text-muted-foreground">{roleName(org, p.role_id)}</div>
                  </div>
                  <div className="flex flex-1 flex-wrap items-center gap-1.5">
                    {here.map((l) => <Tag key={l}>{locName(org, l)}</Tag>)}
                    {here.length === 0 && <span className="text-xs text-warning">Werkt niet waar dit wordt aangeboden</span>}
                    {notHere.length > 0 && <span className="text-xs text-muted-foreground">Niet in {notHere.map((l) => locName(org, l)).join(", ")}</span>}
                  </div>
                  <button type="button" data-row-action onClick={() => setEditPrac(p.id)} className="text-primary" aria-label={`${fullName(p)} aanpassen`}><RowChevron /></button>
                </li>
              ))}
            </ul>
            {doerRows.length > 8 && !showAll && <div className="mt-2"><TextLink onClick={() => setShowAll(true)}>Toon alle {doerRows.length}</TextLink></div>}
            <div className="mt-4"><PillButton variant="outline" onClick={() => setAddOpen(true)}><PlusIcon />Behandelaars toevoegen</PillButton></div>
          </Card>

          <Card title="Wat is er nodig?" description="Een vaste laser hoort bij een kamer. Een verplaatsbare laser zoekt het systeem erbij als die op dat moment op de locatie is, samen met een vrije kamer.">
            <table className="w-full" onClick={rowOpen}>
              <thead><tr className="border-b border-line"><th className={thCls}>Benodigdheid</th><th className={thCls}>Waar het vandaan komt</th><th className={thCls}>Aantal</th><th className={thCls}>Hoe lang</th><th className={thCls} /></tr></thead>
              <tbody className="divide-y divide-line">
                {reqs.map((r) => (
                  <tr key={r.id} data-list-row>
                    <td className={tdCls}>{r.kind === "room" ? "Een kamer" : kindName(org, r.equipment_kind)}</td>
                    <td className={tdCls}>{r.kind === "room" ? "Elke vrije behandelkamer op de locatie" : "Vast in een kamer, of een verplaatsbare die dan op de locatie is"}</td>
                    <td className={tdCls}>{r.quantity}</td>
                    <td className={tdCls}>{optLabel(org, "requirement_duration", r.duration)}</td>
                    <td className={cn(tdCls, "text-right")}>
                      <span className="flex items-center justify-end gap-3">
                        <button type="button" data-row-action onClick={() => setReqModal(r)} className={cn("text-primary", r.kind !== "room" && "order-2")} aria-label="Benodigdheid wijzigen"><RowChevron /></button>
                        {r.kind !== "room" && <Link to="/organisatie/apparatuur" className="order-1 text-sm text-primary underline underline-offset-2">Bekijk apparatuur</Link>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4"><PillButton variant="outline" onClick={() => setReqModal("new")}><PlusIcon />Benodigdheid toevoegen</PillButton></div>
          </Card>

          <Card title="Vragenlijsten en e-mails" description="De mails komen uit de basissjablonen per moment. Wat per behandeling anders is, vul je hier in als tekst; die komt automatisch in de mail. Een eigen sjabloon voor deze behandeling is alleen voor de uitzondering en gaat dan vóór.">
            <div className="grid grid-cols-2 gap-4">
              <Select label="Vragen vóór het boeken" value={pre} onChange={setPre} options={[{ value: "none", label: "Geen" }, ...opts(org, "pre_questionnaire")]} />
              <Select label="Medische vragenlijst na het boeken" value={post} onChange={setPost} options={[{ value: "none", label: "Geen" }, ...opts(org, "post_questionnaire")]} />
              <TextField label="Duur medische vragenlijst (minuten)" inputMode="numeric" value={qmin} onChange={(e) => setQmin(e.target.value.replace(/[^\d]/g, "").slice(0, 2))} help="Deze duur ziet de patiënt in de bevestiging, de intro van de vragenlijst en de mails." />
            </div>
            <div className="mt-5 text-[13px] font-medium">E-mails die voor deze behandeling gaan</div>
            <ul className="mt-1 divide-y divide-line">
              {MAIL_MOMENTS.map((m) => (
                <li key={m} className="flex items-center justify-between py-2.5 text-sm">
                  <span>{m}</span>
                  <span className="flex items-center gap-3"><Tag tone="sand">Basis</Tag><Link to="/boekingsflow/e-mails" className="text-sm text-primary underline underline-offset-2">Bekijk</Link></span>
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col gap-4">
              <TextArea label="Omschrijving voor in de mails" value={texts[textKey("description")]} onChange={(e) => setTexts({ ...texts, [textKey("description")]: e.target.value })} help="Komt in de mails op de plek van {behandeling_omschrijving}, bijvoorbeeld in de kaart “Vragen?”." />
              <TextArea label="Voorbereiding, vooraf aan de patiënt" value={texts[textKey("preparation")]} onChange={(e) => setTexts({ ...texts, [textKey("preparation")]: e.target.value })} help="Komt in de bevestiging en in de herinnering van de afspraak, op de plek van {voorbereiding}. Leeg laten mag." />
              <TextArea label="Nazorg, na de behandeling" value={texts[textKey("aftercare")]} onChange={(e) => setTexts({ ...texts, [textKey("aftercare")]: e.target.value })} help="Komt in de mail “Bedankt en vervolg”, op de plek van {nazorg}." />
              <div className="flex items-center gap-3 rounded-[14px] bg-teal-light px-4 py-3 text-[13px]">
                <span className="flex shrink-0 gap-1">
                  {(["nl", "en"] as const).map((l) => (
                    <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)} className={cn("h-6 rounded-md px-2 text-[11px] font-semibold uppercase", lang === l ? "bg-primary text-primary-foreground" : "bg-background text-foreground")}>{l}</button>
                  ))}
                </span>
                <span>
                  {lang === "nl"
                    ? "Je kijkt naar de Nederlandse teksten. Klik EN voor de Engelse versie van dezelfde drie velden; ontbreekt die, dan krijgt de patiënt Nederlands."
                    : "Je kijkt naar de Engelse teksten. Leeg laten: de patiënt krijgt de Nederlandse tekst."}
                </span>
              </div>
              <div><Link to="/boekingsflow/e-mails"><PillButton variant="outline"><PlusIcon />Eigen sjabloon voor deze behandeling</PillButton></Link></div>
            </div>
          </Card>

          <div className="flex gap-2">
            <PillButton disabled={!canSave} onClick={() => save.mutate()}>Opslaan</PillButton>
            <PillButton variant="outline" onClick={onCancel}>Annuleren</PillButton>
          </div>
        </div>

        <Card className="sticky top-6">
          <h2 className="text-base font-semibold">Boekbaar per locatie</h2>
          <div className="mt-2"><Tag tone={bookability.ok === bookability.total && bookability.total > 0 ? "teal" : "warning"}>{bookability.ok} van {bookability.total} boekbaar</Tag></div>
          <ul className="mt-4 flex flex-col divide-y divide-line text-sm">
            {bookability.perLocation.filter((p) => p.reason !== "ok").map((p) => (
              <li key={p.locationId} className="flex gap-3 py-3">
                <StatusMark kind="warn" />
                <div><div>{locName(org, p.locationId)}</div><div className="text-xs text-muted-foreground">{REASON_TEXT[p.reason]}</div></div>
              </li>
            ))}
            <li className="py-3">
              <button type="button" className="flex w-full items-center gap-3 text-left" aria-expanded={showBookable} onClick={() => setShowBookable(!showBookable)}>
                <StatusMark kind="ok" />
                <span className="flex-1">{bookability.ok} locaties boekbaar</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="text-primary"><path d={showBookable ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} /></svg>
              </button>
              {showBookable && (
                <ul className="mt-2 pl-9 text-xs text-muted-foreground">
                  {bookability.perLocation.filter((p) => p.reason === "ok").map((p) => <li key={p.locationId} className="py-0.5">{locName(org, p.locationId)}</li>)}
                </ul>
              )}
            </li>
            {notOffered.length > 0 && (
              <li className="flex gap-3 py-3">
                <StatusMark kind="none" />
                <span className="text-xs text-muted-foreground">
                  Niet aangeboden: {notOffered.slice(0, 1).map((l) => l.name.toLowerCase()).join("")}{notOffered.length > 1 ? ` en ${notOffered.length - 1} andere locaties` : ""}.
                </span>
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs leading-[1.6] text-muted-foreground">Boekbaar betekent: aangeboden, een behandelaar die het hier doet, en de benodigde kamer en apparatuur aanwezig. Het rooster bepaalt daarna de vrije tijden.</p>
        </Card>
      </div>

      {addOpen && <AddPractitionersModal org={org} treatmentId={id} roleIds={roles} onClose={() => setAddOpen(false)} onSaved={onSaved} />}
      {editPrac && <PractitionerLocationsModal org={org} treatmentId={id} practitionerId={editPrac} onClose={() => setEditPrac(null)} onSaved={onSaved} />}
      {reqModal && <RequirementModal org={org} treatmentId={id} requirement={reqModal === "new" ? null : reqModal} onClose={() => setReqModal(null)} onSaved={onSaved} />}
    </div>
  );
}

function AddPractitionersModal({ org, treatmentId, roleIds, onClose, onSaved }: { org: Org; treatmentId: string; roleIds: string[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const t = org.treatments.find((x) => x.id === treatmentId);
  const offered = offeredLocationIds(org, treatmentId);
  const done = new Set(org.practitionerTreatments.filter((pt) => pt.treatment_id === treatmentId).map((pt) => pt.practitioner_id));
  const [q, setQ] = useState("");
  const [roleF, setRoleF] = useState("all");
  const [locF, setLocF] = useState("all");
  const [picked, setPicked] = useState<string[]>([]);
  const [alsoCats, setAlsoCats] = useState<string[]>([]);
  const candidates = org.practitioners
    .filter((p) => p.status === "active" && !done.has(p.id) && (roleIds.length === 0 || roleIds.includes(p.role_id)))
    .filter((p) => !q || fullName(p).toLowerCase().includes(q.toLowerCase()))
    .filter((p) => roleF === "all" || p.role_id === roleF)
    .filter((p) => locF === "all" || workLocationIds(org, p.id).includes(locF));
  const mains = treatmentMainCategoryIds(org, treatmentId);
  const otherInCat = (catId: string) => {
    const ids = new Set([catId, ...subCategories(org, catId).map((s) => s.id)]);
    return [...new Set(org.categoryLinks.filter((l) => ids.has(l.category_id) && l.treatment_id !== treatmentId).map((l) => l.treatment_id))];
  };
  const add = useMutation({
    mutationFn: async () => {
      await addPractitionersToTreatment(treatmentId, picked);
      const extra = [...new Set(alsoCats.flatMap(otherInCat))];
      for (const tid of extra) {
        const already = new Set(org.practitionerTreatments.filter((pt) => pt.treatment_id === tid).map((pt) => pt.practitioner_id));
        const tRoles = org.treatmentRoles.filter((r) => r.treatment_id === tid).map((r) => r.role_id);
        const ids = picked.filter((p) => !already.has(p) && (tRoles.length === 0 || tRoles.includes(org.practitioners.find((x) => x.id === p)?.role_id ?? "")));
        await addPractitionersToTreatment(tid, ids);
      }
    },
    onSuccess: async () => { await onSaved(); toast.success("Behandelaars toegevoegd"); onClose(); },
    onError: () => toast.error("Toevoegen is niet gelukt"),
  });
  return (
    <Modal
      open
      width="lg"
      onOpenChange={(o) => !o && onClose()}
      title={`Behandelaars toevoegen aan ${t?.name_nl.toLowerCase() ?? ""}`}
      description="Vink aan wie je wilt toevoegen. Ze doen de behandeling meteen op al hun werklocaties waar die wordt aangeboden; dat pas je daarna per persoon aan."
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-sm">{picked.length} behandelaars geselecteerd</span>
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!picked.length || add.isPending} onClick={() => add.mutate()}>Toevoegen ({picked.length})</PillButton></div>
        </div>
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)_190px_190px] gap-2">
        <SearchField placeholder="Zoek op naam" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Zoek op naam" />
        <Select label="Rol" value={roleF} onChange={setRoleF} options={[{ value: "all", label: "Alle rollen" }, ...org.roles.map((r) => ({ value: r.id, label: r.name_nl }))]} className="[&>label]:sr-only" />
        <Select label="Locatie" value={locF} onChange={setLocF} options={[{ value: "all", label: "Alle locaties" }, ...org.locations.map((l) => ({ value: l.id, label: l.name }))]} className="[&>label]:sr-only" />
      </div>
      <div className="mt-3 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{candidates.length} behandelaars beschikbaar</span>
        <span className="flex gap-3"><TextLink onClick={() => setPicked(candidates.map((c) => c.id))}>Selecteer alle {candidates.length}</TextLink><TextLink onClick={() => setPicked([])}>Wis selectie</TextLink></span>
      </div>
      <MultiSelect label="Behandelaars toevoegen" value={picked} onChange={setPicked} options={candidates.map(p => ({value:p.id,label:fullName(p),disabled:!practitionerTreatmentLocations(workLocationIds(org,p.id),offered,[]).length,reason:!practitionerTreatmentLocations(workLocationIds(org,p.id),offered,[]).length ? "Werkt niet waar dit wordt aangeboden" : undefined}))} />
      {mains.length > 0 && (
        <div className="mt-4 rounded-[14px] bg-sand p-4">
          <div className="text-xs">Ook toevoegen aan de andere behandelingen in</div>
          <MultiSelect label="Ook toevoegen aan categorieën" value={alsoCats} onChange={setAlsoCats} options={mains.map(c => ({value:c,label:org.categories.find(x => x.id===c)?.name_nl ?? c}))} />
        </div>
      )}
    </Modal>
  );
}

function PractitionerLocationsModal({ org, treatmentId, practitionerId, onClose, onSaved }: { org: Org; treatmentId: string; practitionerId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const p = org.practitioners.find((x) => x.id === practitionerId);
  const pt = org.practitionerTreatments.find((x) => x.treatment_id === treatmentId && x.practitioner_id === practitionerId);
  const t = org.treatments.find((x) => x.id === treatmentId);
  const candidates = useMemo(() => practitionerTreatmentLocations(workLocationIds(org, practitionerId), offeredLocationIds(org, treatmentId), []), [org, practitionerId, treatmentId]);
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
  if (!p || !t) return null;
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={`${fullName(p)} · ${t.name_nl}`}
      description="Op welke van haar werklocaties doet zij deze behandeling?"
      footer={
        <div className="flex w-full items-center justify-between">
          <TextLink tone="warning" onClick={() => remove.mutate()}>Niet meer laten doen</TextLink>
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2">
        <MultiSelect label="Locaties voor deze behandelaar" options={candidates.map(l => ({value:l,label:locName(org,l)}))} value={candidates.filter(l => !excluded.includes(l))} onChange={ids => setExcluded(candidates.filter(l => !ids.includes(l)))} />
        {candidates.length === 0 && <p className="text-sm text-warning">Werkt niet waar dit wordt aangeboden.</p>}
      </div>
    </Modal>
  );
}

function RequirementModal({ org, treatmentId, requirement, onClose, onSaved }: { org: Org; treatmentId: string; requirement: Requirement | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const kindOptions = [{ value: "room", label: "Een kamer" }, ...kindOpts(org)];
  const [kind, setKind] = useState(requirement ? (requirement.kind === "room" ? "room" : requirement.equipment_kind ?? "room") : "room");
  const [qty, setQty] = useState(String(requirement?.quantity ?? 1));
  const [duration, setDuration] = useState(requirement?.duration ?? "whole");
  const save = useMutation({
    mutationFn: () =>
      saveRequirement(requirement?.id ?? null, {
        treatment_id: treatmentId,
        kind: kind === "room" ? "room" : "equipment",
        equipment_kind: kind === "room" ? null : kind,
        quantity: Number(qty),
        duration,
        sort: requirement?.sort ?? 99,
      }),
    onSuccess: async () => { await onSaved(); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteRequirement(requirement?.id ?? ""),
    onSuccess: async () => { await onSaved(); toast.success("Verwijderd"); onClose(); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={requirement ? "Benodigdheid wijzigen" : "Benodigdheid toevoegen"}
      description="Een tijd is alleen boekbaar als alles wat hier staat op dat moment vrij is."
      footer={
        <div className="flex w-full items-center justify-between">
          {requirement ? <TextLink tone="warning" onClick={() => del.mutate()}>Verwijderen</TextLink> : <span />}
          <div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></div>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-4">
        <Select label="Benodigdheid" value={kind} onChange={setKind} options={kindOptions} className="col-span-2" />
        <Select label="Aantal" value={qty} onChange={setQty} options={["1", "2", "3"].map((v) => ({ value: v, label: v }))} />
        <Select label="Hoe lang" value={duration} onChange={setDuration} options={opts(org, "requirement_duration")} />
      </div>
    </Modal>
  );
}
