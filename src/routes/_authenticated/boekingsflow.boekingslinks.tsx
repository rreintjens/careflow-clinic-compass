import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute,Link as RouteLink } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Card } from "@/components/Card";
import { Chip, SearchField, PlusIcon, StatusMark, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/PageHeader";
import { PillButton } from "@/components/PillButton";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MultiSelect } from "@/components/MultiSelect";
import { Select } from "@/components/Select";
import { StartScreenEditor } from "@/features/questionnaire/StartScreenEditor";
import { Boodschap } from "@/features/questionnaire/QuestionnaireRunner";
import { readStartScreen,startScreenPage } from "@/domain/start-screen";
import { attributionQuery } from "@/data/attribution";
import { normalizeCode,structuredBookingUrl } from "@/domain/attribution";
import { bookingLinkUsageQuery, bookingLinksQuery, type BookingLinksData } from "@/data/booking-links";
import { saveBookingLink } from "@/data/booking-links.functions";
import { absoluteBookingLinkUtm, bookingLinkPath, linkLocations, linkPractitioners, linkProblem, uniqueSlug, scopeTreatments, scopePractitioners, scopeUnbookable, type LinkCatalog, type LinkScope } from "@/domain/booking-links";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/boekingsflow/boekingslinks")({
  head: () => ({ meta: [{ title: "Boekingslinks · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(bookingLinksQuery), context.queryClient.ensureQueryData(bookingLinkUsageQuery),context.queryClient.ensureQueryData(attributionQuery)]),
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
    treatments: d.treatments.map((t) => ({ id: t.id, locations: offers.get(t.id) ?? [],categories:d.categoryLinks.filter(l=>l.treatment_id===t.id).map(l=>l.category_id) })),
    categories:d.categories,
    practitioners: d.practitioners.map((p) => ({ id:p.id, treatments: does.get(p.id) ?? [], locations: [...(at.get(p.id) ?? []),...(d.mixed.some(b=>b.practitioner_id===p.id)?d.locations.filter(l=>l.kind==="online").map(l=>l.id):[])],exclusions:d.practitionerTreatments.filter(t=>t.practitioner_id===p.id) })),
  };
}

function BookingLinksPage() {
  const { data: d } = useSuspenseQuery(bookingLinksQuery);
  const { data: usage } = useSuspenseQuery(bookingLinkUsageQuery);
  const {data:attribution}=useSuspenseQuery(attributionQuery);
  const [search,setSearch]=useState("");
  const [channelFilter,setChannelFilter]=useState("all");const [campaignFilter,setCampaignFilter]=useState("all");
  const [editing, setEditing] = useState<Link | "new" | null>(null);
  const modeLabel = (v: string | null) => d.options.find((o) => o.value === v)?.label_nl ?? "Uit de behandeling";
  const nameOf = (id: string | null) => (id ? d.treatments.find((t) => t.id === id)?.name_nl ?? "–" : "Patiënt kiest zelf");
  const pracName = (id: string | null) => {
    const p = d.practitioners.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "–";
  };

  return (
    <ListPage>
      <PageHeader
        title="Boekingslinks"
        description="Een boekingslink brengt een patiënt direct naar de juiste behandeling, locatie en taal. De bron gaat mee met elke boeking, zodat je de instroom per kanaal ziet."
        actions={<PillButton onClick={() => setEditing("new")}><PlusIcon />Nieuwe boekingslink</PillButton>}
      />
      <div className="flex flex-wrap items-end gap-3"><SearchField aria-label="Zoek boekingslink" placeholder="Zoek boekingslink" value={search} onChange={e=>setSearch(e.target.value)}/><RouteLink to="/boekingsflow/kanalen-en-campagnes" className="text-sm text-primary">Kanalen en campagnes</RouteLink><Select label="Kanaal" value={channelFilter} onChange={setChannelFilter} options={[{value:"all",label:"Alle kanalen"},...attribution.channels.map(c=>({value:c.id,label:c.name}))]}/><Select label="Campagne" value={campaignFilter} onChange={setCampaignFilter} options={[{value:"all",label:"Alle campagnes"},...attribution.campaigns.map(c=>({value:c.id,label:c.name}))]}/></div>
      <DataTable count={d.links.length} label="boekingslinks">
        <div className="overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1fr)_150px_90px_110px] gap-x-2 px-1 pb-2 text-xs text-muted-foreground">
            <span>Naam</span><span>Kanaal / Campagne</span><span>Behandeling</span><span>Locaties</span><span>Behandelaar</span><span>Boekingen</span><span />
          </div>
          {d.links.filter(l=>l.name.toLowerCase().includes(search.toLowerCase())&&(channelFilter==="all"||l.channel_id===channelFilter)&&(campaignFilter==="all"||l.campaign_id===campaignFilter)).map((l) => (
            <div key={l.id} onClick={()=>setEditing(l)} className="list-item grid min-w-[900px] grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_minmax(0,1fr)_150px_90px_110px] items-center gap-x-2 border-t border-line px-1 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm">{l.name}</div>
                <div className="truncate text-xs text-muted-foreground">{bookingLinkPath(l.hash)}</div>
              </div>
              <span className="truncate text-sm text-muted-foreground">{attribution.channels.find(c=>c.id===l.channel_id)?.name??"Overig"}<span className="block text-xs">{attribution.campaigns.find(c=>c.id===l.campaign_id)?.name}</span></span>
              <span className="truncate text-sm">{[...l.category_ids.map(id=>d.categories.find(c=>c.id===id)?.name_nl),...l.treatment_ids.map(id=>nameOf(id))].filter(Boolean).join(", ") || "Alle behandelingen"}</span>
              <span className="truncate text-sm text-muted-foreground">{l.location_ids.length ? l.location_ids.map((id) => d.locations.find((x) => x.id === id)?.name ?? "?").join(", ") : "–"}</span>
              <span className="truncate text-sm text-muted-foreground">{l.practitioner_scope === "selected" ? `${l.practitioner_ids.length} behandelaars` : "Alle behandelaars"}</span>
              <span className="text-sm">{usage.get(l.id) ?? 0}</span>
              <span className="flex items-center justify-end gap-3 whitespace-nowrap">
                <StatusMark kind={l.status === "active" ? "ok" : "none"} />
                <button type="button" onClick={() => setEditing(l)} className="text-[13px] text-primary hover:text-primary-hover" aria-label="Boekingslink openen"><RowChevron/></button>
              </span>
            </div>
          ))}
          {d.links.length === 0 && <p className="border-t border-line py-6 text-sm text-muted-foreground">Nog geen boekingslinks. Maak er één aan voor een kanaal, campagne of samenwerking.</p>}
        </div>
      </DataTable>
      {editing && (
        <LinkModal d={d} link={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      )}
    </ListPage>
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
  const explanation = (v:string) => v === "assigned" ? "De patiënt kiest niet; de minst drukke behandelaar krijgt de afspraak." : v === "optional" ? "De patiënt mag kiezen of Geen voorkeur." : "De keuzestap wordt altijd getoond; Geen voorkeur blijft een keuze.";
  const modeOptions = d.options.filter(o=>o.value!=="fixed").map((o) => ({ value: o.value, label: o.label_nl,detail:explanation(o.value) }));

  const [startMode,setStartMode]=useState(link?.start_screen_mode??"treatment");
  const [startScreen,setStartScreen]=useState(readStartScreen(link?.start_screen));
  const [fixedTreatment, setFixedTreatment] = useState(!!link?.treatment_ids.length || !!link?.category_ids.length);
  const [selection,setSelection]=useState<string[]>([...(link?.treatment_ids ?? []),...(link?.category_ids ?? []).map(id=>`category:${id}`)]);
  const [practitionerScope,setPractitionerScope]=useState(link?.practitioner_scope??"all");
  const [practitionerIds,setPractitionerIds]=useState<string[]>(link?.practitioner_ids??[]);
  const [locationIds, setLocationIds] = useState<string[]>(link?.location_ids ?? []);
  const [mode, setMode] = useState(link?.practitioner_mode ?? "");

  const [language, setLanguage] = useState<"nl" | "en">(link?.language === "en" ? "en" : "nl");
  const [name, setName] = useState(link?.name ?? "");
  const {data:attribution}=useSuspenseQuery(attributionQuery);
  const [channelId,setChannelId]=useState(link?.channel_id??attribution.channels.find(c=>c.active)?.id??"");
  const [placeId,setPlaceId]=useState(link?.place_id??"");
  const [campaignId,setCampaignId]=useState(link?.campaign_id??attribution.campaigns.find(c=>c.code==="doorlopend")?.id??"");
  const [extra,setExtra]=useState(link?.extra??"");
  const channel=attribution.channels.find(c=>c.id===channelId);const place=attribution.places.find(p=>p.id===placeId);const campaign=attribution.campaigns.find(c=>c.id===campaignId);const source=channel?.name??"";


  const draft: LinkScope = {
    treatment_id:null,practitioner_id:null,
    treatment_ids:fixedTreatment?selection.filter(id=>!id.startsWith("category:")):[],
    category_ids:fixedTreatment?selection.filter(id=>id.startsWith("category:")).map(id=>id.slice(9)):[],
    practitioner_scope:practitionerScope==="selected"?"selected":"all",practitioner_ids:practitionerScope==="selected"?practitionerIds:[],
    location_ids:locationIds,practitioner_mode:mode||null,
  };
  const tids=scopeTreatments(catalog,draft);
  const unbookable=scopeUnbookable(catalog,draft);
  const problem=!locationIds.length?"no_location":practitionerScope==="selected"&&!practitionerIds.length?"no_practitioner":!tids.length||unbookable.length===tids.length?"practitioner_unavailable":null;
  const at=locationIds;
  const people=[...new Set(tids.flatMap(id=>scopePractitioners(catalog,{...draft,practitioner_scope:"all"},id)))];
  const taken = d.links.filter((x) => x.id !== link?.id).map((x) => x.slug);
  const slug = link?.hash || uniqueSlug(taken, name.trim() || "nieuw");
  const share = `${window.location.origin}${bookingLinkPath(slug)}${d.tenant?.test_mode && d.tenant.slug ? `&merk=${d.tenant.slug}` : ""}`;
  const shareUtm = link ? `${structuredBookingUrl({channel:source,source:channel?.utm_source??"",medium:channel?.utm_medium??"",place:place?.name??"",content:place?.code??"",campaign:campaign?.name??"",campaignCode:campaign?.code??"",extra,hash:link.hash},window.location.origin)}${d.tenant?.test_mode?`&merk=${d.tenant.slug}`:""}` : "De definitieve linkcode verschijnt na opslaan.";

  const save = useMutation({
    mutationFn: () =>
      saveLink({
        data: {
          id: link?.id ?? null,
          slug,
          name: name.trim(),
          source: source.trim(),start_screen_mode:startMode==="custom"?"custom":startMode==="none"?"none":"treatment",start_screen:startScreen,channel_id:channelId||null,place_id:placeId||null,campaign_id:campaignId||null,extra,
          treatment_id: draft.treatment_id,
          location_ids: draft.location_ids,
          practitioner_mode: draft.practitioner_mode,
          practitioner_id: null,
          treatment_ids:draft.treatment_ids??[],category_ids:draft.category_ids??[],practitioner_ids:draft.practitioner_ids??[],practitioner_scope:draft.practitioner_scope??"all",
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

  const treatment = tids.length===1?d.treatments.find(t=>t.id===tids[0]):null;
  const inherited = treatment ? `nu: ${d.options.find(o=>o.value===treatment.practitioner_choice)?.label_nl??treatment.practitioner_choice}` : "volgt de instelling per behandeling";
  const preview=[{k:"Behandelingen",v:fixedTreatment?tids.map(id=>d.treatments.find(t=>t.id===id)?.name_nl).join(", "):"Alle behandelingen"},{k:"Locaties",v:at.map(id=>d.locations.find(l=>l.id===id)?.name).join(", ")||"Nog geen locatie gekozen"},{k:"Behandelaars",v:practitionerScope==="selected"?`${practitionerIds.length} behandelaars`:"Alle behandelaars die dit doen"},{k:"Keuze voor de patiënt",v:mode?explanation(mode):`Zoals de behandeling (${inherited})`},{k:"Taal",v:language==="nl"?"Nederlands":"Engels"}];
  return (
    <Modal
      open
      onOpenChange={(o) => !o && onClose()}
      title={link ? link.name : "Nieuwe boekingslink"}
      description="Loop de vijf stappen door. Rechts zie je direct wat de patiënt ziet, met daaronder de link om te kopiëren."
      width="lg"
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!!problem || !name.trim() || !channelId || !placeId || !campaignId || save.isPending} onClick={() => save.mutate()}>Link opslaan</PillButton></>}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_260px] items-start gap-6">
        <div className="flex flex-col gap-5">
          <Step n={1} title="Behandelingen" sub="Kies alle behandelingen, losse behandelingen of een hele categorie.">
            <Select label="Behandelingen" value={fixedTreatment?"selected":"all"} onChange={v=>setFixedTreatment(v==="selected")} options={[{value:"all",label:"Alle behandelingen"},{value:"selected",label:"Een selectie"}]} />
            {fixedTreatment && <MultiSelect className="mt-3" label="Selectie behandelingen en categorieën" value={selection} onChange={setSelection} options={[...d.categories.map(c=>({value:`category:${c.id}`,label:`Hele ${c.name_nl}`,group:d.categories.find(p=>p.id===c.parent_id)?.name_nl??c.name_nl,detail:"Inclusief later toegevoegde behandelingen"})),...d.treatments.map(t=>({value:t.id,label:t.name_nl}))]} />}
          </Step>
          {tids.length===1&&fixedTreatment&&<section className="border-b border-line py-4"><Select label="Startscherm" value={startMode} onChange={setStartMode} options={[{value:"treatment",label:"Zoals de behandeling"},{value:"custom",label:"Eigen tekst voor deze link"},{value:"none",label:"Geen startscherm"}]}/>{startMode==="custom"&&<StartScreenEditor value={startScreen} onChange={setStartScreen} defaultButton="Kies waar en wanneer"/>}{startMode==="custom"&&startScreen?.enabled&&<div className="mt-3"><p className="font-medium">{startScreen.title}</p><p className="text-sm">{startScreen.body}</p><Boodschap page={startScreenPage(startScreen,language)} vars={{}}/></div>}</section>}
          <Step n={2} title="Locaties" sub="Kies waar patiënten via deze link mogen boeken.">
            <MultiSelect label="Locaties" value={locationIds} onChange={setLocationIds} options={locations.map(l=>({value:l.id,label:l.name}))} />
          </Step>
          <Step n={3} title="Behandelaars" sub="De patiënt ziet alleen tijden binnen deze selectie.">
            <Select label="Welke behandelaars" value={practitionerScope} onChange={setPractitionerScope} options={[{value:"all",label:"Alle behandelaars die dit doen"},{value:"selected",label:"Alleen deze behandelaars"}]} />
            {practitionerScope==="selected" && <MultiSelect className="mt-3" label="Behandelaars" value={practitionerIds} onChange={setPractitionerIds} options={d.practitioners.map(p=>({value:p.id,label:`${p.first_name} ${p.last_name}`,disabled:!people.includes(p.id),reason:!people.includes(p.id)?"Doet geen gekozen behandeling op deze locaties":undefined}))} />}
            <Select className="mt-3" label="Keuze voor de patiënt" value={mode} onChange={setMode} options={[{value:"",label:"Zoals de behandeling",detail:`Volgt de instelling van de behandeling (${inherited}).`},...modeOptions]} help={mode?explanation(mode):`Volgt de instelling van de behandeling (${inherited}).`} />
            {unbookable.map(id=><p key={id} className="mt-2 text-xs text-warning">{d.treatments.find(t=>t.id===id)?.name_nl}: geen van de gekozen behandelaars doet dit op deze locaties.</p>)}
          </Step>
          <Step n={4} title="Taal" sub="De flow opent in deze taal. Op het eerste scherm kan de patiënt nog wisselen.">
            <SegmentedControl label="Taal" value={language} onChange={(v) => setLanguage(v as "nl" | "en")} options={[{ value: "nl", label: "Nederlands" }, { value: "en", label: "English" }]} />
          </Step>

          <Step n={5} title="Waar gebruik je deze link?" sub="Kies het kanaal, de plek en de campagne.">
            <div className="flex flex-col gap-4"><Select label="Kanaal" value={channelId} onChange={id=>{setChannelId(id);setPlaceId(attribution.places.find(p=>p.channel_id===id&&p.active)?.id??"");}} options={attribution.channels.filter(c=>c.active||c.id===channelId).map(c=>({value:c.id,label:c.name}))}/><Select label="Plek" value={placeId} onChange={setPlaceId} options={attribution.places.filter(p=>p.channel_id===channelId&&(p.active||p.id===placeId)).map(p=>({value:p.id,label:p.name}))}/><Select label="Campagne" value={campaignId} onChange={setCampaignId} options={attribution.campaigns.filter(c=>c.active||c.id===campaignId).map(c=>({value:c.id,label:c.name}))}/><TextField label="Extra kenmerk" value={extra} maxLength={30} onChange={e=>setExtra(normalizeCode(e.target.value).slice(0,30))}/><TextField label="Naam (intern)" value={name} placeholder={[source,place?.name,campaign?.name,treatment?.name_nl].filter(Boolean).join(" · ")} onChange={e=>setName(e.target.value)}/><PillButton variant="ghost" size="sm" onClick={()=>setName([source,place?.name,campaign?.name,treatment?.name_nl].filter(Boolean).join(" · ").slice(0,80))}>Voorgestelde naam gebruiken</PillButton></div>
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
            <p className="mt-4 text-[13px] font-semibold">Met utm voor je eigen statistieken</p>
            <p className="mt-1 text-[12px] leading-[1.5] text-muted-foreground">Kanaal: {source} · Plek: {place?.name} · Campagne: {campaign?.name} · Kenmerk: {extra||"–"} · Code: {link?.hash??"na opslaan"}</p>
            <button type="button" onClick={() => void navigator.clipboard.writeText(shareUtm).then(() => toast.success("Link met utm gekopieerd"), () => toast.error("Kopiëren is niet gelukt"))} className="mt-2 text-[13px] text-primary underline">Link met utm kopiëren</button>
            <p className="mt-3 break-all text-[12px] leading-[1.5] text-muted-foreground">{shareUtm}</p>
          </div>
          {problem === "no_location" && <p className="text-[13px] leading-[1.5] text-warning">Kies eerst minstens één locatie waar deze behandelaar dit doet.</p>}
        </div>
      </div>
    </Modal>
  );
}
