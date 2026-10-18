import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Chip, PlusIcon, StatusMark, TextField, tdCls, thCls } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { Select } from "@/components/Select";
import { bookingLinkUsageQuery, bookingLinksQuery, type BookingLinksData } from "@/data/booking-links";
import { saveBookingLink } from "@/data/booking-links.functions";
import { bookingLinkPath, linkLocations, linkPractitioners, linkProblem, uniqueSlug, type LinkCatalog, type LinkDraft } from "@/domain/booking-links";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/boekingsflow/boekingslinks/")({
  head: () => ({ meta: [{ title: "Boekingslinks · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(bookingLinksQuery), context.queryClient.ensureQueryData(bookingLinkUsageQuery)]),
  component: BookingLinksPage,
});

type Link = Tables<"booking_links">;

/** Which locations offer a treatment, and what each practitioner does there — from the tenant's own rows. */
function catalogOf(d: BookingLinksData): LinkCatalog {
  const add = (m: Map<string, string[]>, k: string, v: string) => {
    const list = m.get(k);
    if (list) list.push(v);
    else m.set(k, [v]);
  };
  const open = new Set(d.locations.filter((l) => l.status === "open").map((l) => l.id));
  const offers = new Map<string, string[]>();
  for (const r of d.treatmentLocations) if (open.has(r.location_id)) add(offers, r.treatment_id, r.location_id);
  const at = new Map<string, string[]>();
  for (const r of d.practitionerLocations) if (open.has(r.location_id)) add(at, r.practitioner_id, r.location_id);
  const does = new Map<string, string[]>();
  for (const r of d.practitionerTreatments) add(does, r.practitioner_id, r.treatment_id);
  return {
    treatments: d.treatments.map((t) => ({ id: t.id, locations: offers.get(t.id) ?? [] })),
    practitioners: [...at.keys()].map((id) => ({ id, treatments: does.get(id) ?? [], locations: at.get(id) ?? [] })),
  };
}

function BookingLinksPage() {
  const { data: d } = useSuspenseQuery(bookingLinksQuery);
  const { data: usage } = useSuspenseQuery(bookingLinkUsageQuery);
  const [editing, setEditing] = useState<Link | "new" | null>(null);
  const modeLabel = (v: string | null) => d.options.find((o) => o.value === v)?.label_nl ?? "Uit de behandeling";
  const nameOf = (id: string | null) => (id ? d.treatments.find((t) => t.id === id)?.name_nl ?? "–" : "Patiënt kiest zelf");
  const pracName = (id: string | null) => {
    const p = d.practitioners.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "–";
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Boekingslinks"
        description="Een boekingslink brengt een patiënt direct naar de juiste behandeling, locatie en taal. De bron gaat mee met elke boeking, zodat je de instroom per kanaal ziet."
        actions={<PillButton onClick={() => setEditing("new")}><PlusIcon />Nieuwe boekingslink</PillButton>}
      />
      <Card>
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1fr)_150px_90px_110px] gap-x-2 px-1 pb-2 text-xs text-muted-foreground">
            <span>Naam</span><span>Bron</span><span>Behandeling</span><span>Locaties</span><span>Behandelaar</span><span>Boekingen</span><span />
          </div>
          {d.links.map((l) => (
            <div key={l.id} className="grid min-w-[900px] grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1fr)_150px_90px_110px] items-center gap-x-2 border-t border-line px-1 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{l.name}</div>
                <div className="truncate text-xs text-muted-foreground">{bookingLinkPath(l.slug)}</div>
              </div>
              <span className="truncate text-sm text-muted-foreground">{l.source || "–"}</span>
              <span className="truncate text-sm">{nameOf(l.treatment_id)}</span>
              <span className="truncate text-sm text-muted-foreground">{l.location_ids.length ? l.location_ids.map((id) => d.locations.find((x) => x.id === id)?.name ?? "?").join(", ") : "–"}</span>
              <span className="truncate text-sm text-muted-foreground">{l.practitioner_mode === "fixed" ? pracName(l.practitioner_id) : modeLabel(l.practitioner_mode)}</span>
              <span className="text-sm">{usage.get(l.id) ?? 0}</span>
              <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                <StatusMark kind={l.status === "active" ? "ok" : "none"} />
                <button type="button" onClick={() => setEditing(l)} className="text-[13px] text-primary hover:text-primary-hover">Wijzig</button>
              </span>
            </div>
          ))}
          {d.links.length === 0 && <p className="border-t border-line py-6 text-sm text-muted-foreground">Nog geen boekingslinks. Maak er één aan voor een kanaal, campagne of samenwerking.</p>}
        </div>
      </Card>
      {editing && (
        <LinkModal d={d} link={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function Step({ n, title, sub, children }: { n: number; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-teal-light text-[13px] font-semibold text-primary">{n}</span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="mt-0.5 text-[13px] leading-[1.5] text-muted-foreground">{sub}</p>
        </div>
      </div>
      <div className="pl-10">{children}</div>
    </section>
  );
}

/** The five steps of link-maken.dc.html, with the patient preview and the link itself beside them. */
function LinkModal({ d, link, onClose }: { d: BookingLinksData; link: Link | null; onClose: () => void }) {
  const saveLink = useServerFn(saveBookingLink);
  const qc = useQueryClient();
  const catalog = useMemo(() => catalogOf(d), [d]);
  const locations = d.locations.filter((l) => l.status === "open");
  const modeOptions = d.options.map((o) => ({ value: o.value, label: o.label_nl }));

  const [fixedTreatment, setFixedTreatment] = useState(!!link?.treatment_id);
  const [treatmentId, setTreatmentId] = useState(link?.treatment_id ?? d.treatments[0]?.id ?? "");
  const [locationIds, setLocationIds] = useState<string[]>(link?.location_ids ?? []);
  const [mode, setMode] = useState(link?.practitioner_mode ?? "");
  const [practitionerId, setPractitionerId] = useState(link?.practitioner_id ?? "");
  const [language, setLanguage] = useState<"nl" | "en">(link?.language === "en" ? "en" : "nl");
  const [name, setName] = useState(link?.name ?? "");
  const [source, setSource] = useState(link?.source ?? "");

  const draft: LinkDraft = {
    treatment_id: fixedTreatment ? treatmentId || null : null,
    location_ids: locationIds,
    practitioner_mode: mode || null,
    practitioner_id: mode === "fixed" ? practitionerId || null : null,
  };
  const problem = linkProblem(catalog, draft);
  const at = linkLocations(catalog, draft);
  const people = linkPractitioners(catalog, draft);
  const taken = d.links.filter((x) => x.id !== link?.id).map((x) => x.slug);
  const slug = link?.slug || uniqueSlug(taken, name.trim() || "nieuw");
  const share = `${window.location.origin}${bookingLinkPath(slug)}${d.tenant?.test_mode && d.tenant.slug ? `&merk=${d.tenant.slug}` : ""}`;

  const save = useMutation({
    mutationFn: () =>
      saveLink({
        data: {
          id: link?.id ?? null,
          slug: link?.slug ?? "",
          name: name.trim(),
          source: source.trim(),
          treatment_id: draft.treatment_id,
          location_ids: draft.location_ids,
          practitioner_mode: draft.practitioner_mode,
          practitioner_id: draft.practitioner_id,
          language,
          status: link?.status ?? "active",
        },
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: bookingLinksQuery.queryKey });
      await qc.invalidateQueries({ queryKey: bookingLinkUsageQuery.queryKey });
      toast.success(link ? "Boekingslink bijgewerkt" : "Boekingslink aangemaakt");
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error && e.message ? e.message : "Opslaan is niet gelukt"),
  });

  const treatment = d.treatments.find((t) => t.id === treatmentId) ?? null;
  const preview: Array<{ k: string; v: string }> = [
    { k: "Behandeling", v: draft.treatment_id ? treatment?.name_nl ?? "–" : "Patiënt kiest zelf een behandeling" },
    { k: "Locaties", v: at.length ? at.map((id) => d.locations.find((l) => l.id === id)?.name ?? "?").join(", ") : "Nog geen locatie gekozen" },
    { k: "Behandelaar", v: draft.practitioner_mode === "fixed" ? people.find((p) => p === draft.practitioner_id) ? `${d.practitioners.find((x) => x.id === draft.practitioner_id)?.first_name ?? ""} ${d.practitioners.find((x) => x.id === draft.practitioner_id)?.last_name ?? ""}` : "–" : d.options.find((o) => o.value === draft.practitioner_mode)?.label_nl ?? "Zoals de behandeling dat heeft" },
    { k: "Taal", v: language === "nl" ? "Nederlands" : "Engels" },
  ];

  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={link ? link.name : "Nieuwe boekingslink"}
      description="Loop de vijf stappen door. Rechts zie je direct wat de patiënt ziet, met daaronder de link om te kopiëren."
      width="lg"
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!!problem || !name.trim() || save.isPending} onClick={() => save.mutate()}>Link opslaan</PillButton></>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-6">
        <div className="flex flex-col gap-5">
          <Step n={1} title="Behandeling" sub="Zet één behandeling vast, of laat de patiënt kiezen.">
            <SegmentedControl label="Behandeling" value={fixedTreatment ? "vast" : "kiezen"} onChange={(v) => setFixedTreatment(v === "vast")}
              options={[{ value: "kiezen", label: "Patiënt kiest zelf" }, { value: "vast", label: "Eén behandeling vastzetten" }]} />
            {fixedTreatment && (
              <div className="mt-3 flex flex-col gap-2">
                <Select label="Behandeling" value={treatmentId} onChange={setTreatmentId} options={d.treatments.map((t) => ({ value: t.id, label: `${t.name_nl} · ${t.duration_min} minuten` }))} />
                {treatment && <p className="text-xs text-muted-foreground">{treatment.duration_min} minuten · standaard keuze behandelaar: {modeOptions.find((o) => o.value === treatment.practitioner_choice)?.label ?? treatment.practitioner_choice}</p>}
              </div>
            )}
          </Step>

          <Step n={2} title="Locaties" sub="Kies de locaties waaruit de patiënt kan kiezen.">
            <div className="flex flex-wrap gap-2">
              {locations.map((l) => (
                <Chip key={l.id} selected={locationIds.includes(l.id)} onClick={() => setLocationIds(locationIds.includes(l.id) ? locationIds.filter((x) => x !== l.id) : [...locationIds, l.id])}>
                  {l.name}
                </Chip>
              ))}
            </div>
            <div className="mt-3 flex gap-4">
              <button type="button" onClick={() => setLocationIds(locations.map((l) => l.id))} className="text-[13px] text-primary underline">Alle locaties</button>
              <button type="button" onClick={() => setLocationIds([])} className="text-[13px] text-muted-foreground underline">Wis keuze</button>
            </div>
          </Step>

          <Step n={3} title="Keuze behandelaar" sub="Bepaal of en hoe de patiënt een behandelaar kiest, zoals een arts of huidtherapeut.">
            <Select label="Keuze behandelaar" value={mode} onChange={setMode} options={[{ value: "", label: "Zoals de behandeling dat heeft" }, ...modeOptions]} />
            {mode === "fixed" && (
              <div className="mt-3">
                <Select label="Welke behandelaar?" value={practitionerId} onChange={setPractitionerId}
                  options={people.map((id) => { const p = d.practitioners.find((x) => x.id === id); return { value: id, label: p ? `${p.first_name} ${p.last_name}` : id }; })} />
              </div>
            )}
            {problem === "practitioner_unavailable" && <p className="mt-2 text-[13px] text-warning">Kies eerst minstens één locatie waar deze behandelaar dit doet.</p>}
          </Step>

          <Step n={4} title="Taal" sub="De flow opent in deze taal. Op het eerste scherm kan de patiënt nog wisselen.">
            <SegmentedControl label="Taal" value={language} onChange={(v) => setLanguage(v as "nl" | "en")} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "English" }]} />
          </Step>

          <Step n={5} title="Naam en bron" sub="De naam zie je terug in het overzicht van boekingslinks. De bron gaat mee met elke boeking, zodat je de instroom per kanaal ziet.">
            <div className="flex flex-col gap-4">
              <TextField label="Naam (intern)" value={name} onChange={(e) => setName(e.target.value)} />
              <TextField label="Bron voor rapportage (optioneel)" value={source} onChange={(e) => setSource(e.target.value)} help="Leeg laten: de boeking telt dan mee onder de voorkeursbron van de patiënt." />
            </div>
          </Step>
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[16px] bg-sand p-4">
            <p className="text-[13px] font-semibold">Wat de patiënt ziet</p>
            <dl className="mt-3 flex flex-col gap-2">
              {preview.map((p) => (
                <div key={p.k}>
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.k}</dt>
                  <dd className="text-[13px] leading-[1.45]">{p.v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 border-t border-mist pt-3 text-[12px] leading-[1.5] text-muted-foreground">Daarna volgen de vragen, de gegevens en de bevestiging.</p>
          </div>
          <div className="rounded-[16px] border border-line p-4">
            <p className="text-[13px] font-semibold">Je link</p>
            <p className="mt-2 truncate text-[12px] text-muted-foreground">{bookingLinkPath(slug)}</p>
            <button type="button" onClick={() => void navigator.clipboard.writeText(share).then(() => toast.success("Link gekopieerd"), () => toast.error("Kopiëren is niet gelukt"))} className="mt-2 text-[13px] text-primary underline">Link kopiëren</button>
            <p className="mt-3 break-all text-[12px] leading-[1.5] text-muted-foreground">{share}</p>
          </div>
          {problem === "no_location" && <p className="text-[13px] leading-[1.5] text-warning">Kies eerst minstens één locatie waar deze behandelaar dit doet.</p>}
        </div>
      </div>
    </Modal>
  );
}
