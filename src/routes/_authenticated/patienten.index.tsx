import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { agendaRefQuery } from "@/data/agenda";
import { patientListQuery, questionnaireState, searchPatients } from "@/data/patients";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patienten/")({
  head: () => ({ meta: [{ title: "Patiënten · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

const TZ = "Europe/Amsterdam";
const localDate = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: TZ });
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** UTC instant of local midnight for a yyyy-mm-dd in Amsterdam. */
const midnight = (iso: string) => { const g = new Date(`${iso}T00:00:00Z`); const off = new Date(g.toLocaleString("en-US", { timeZone: TZ })).getTime() - new Date(g.toLocaleString("en-US", { timeZone: "UTC" })).getTime(); return new Date(g.getTime() - off).toISOString(); };
const hm = (s: string) => new Date(s).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
const dayShort = (s: string) => new Date(s).toLocaleString("nl-NL", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(" om ", ", ");

function Page() {
  const navigate = useNavigate();
  const today = localDate(new Date());
  const [day, setDay] = useState(today);
  const [mode, setMode] = useState<"created" | "starting">("created");
  const [treat, setTreat] = useState("all");
  const [loc, setLoc] = useState("all");
  const [prac, setPrac] = useState("all");
  const [q, setQ] = useState("");
  const ref = useSuspenseQuery(agendaRefQuery).data;
  const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;
  const { data } = useQuery(patientListQuery(midnight(day), midnight(addDays(day, 1)), midnight(addDays(day, -weekday))));
  const { data: hits = [] } = useQuery({ queryKey: ["patient-search", q], queryFn: () => searchPatients(q), enabled: q.trim().length >= 2 });

  const rows = (mode === "created" ? data?.created : data?.starting) ?? [];
  const shown = rows.filter((a) => (treat === "all" || a.treatment_id === treat) && (loc === "all" || a.location_id === loc) && (prac === "all" || a.practitioner_id === prac));
  const openQ = (data?.starting ?? []).filter((a) => questionnaireState(a.treatment?.post_questionnaire_key, data?.sets ?? [], a.id) === "open").length;
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const all = (l: string) => [{ value: "all", label: l }];

  return (
    <ListPage>
      <PageHeader title="Patiënten" actions={
        <div className="relative">
          <div className="flex h-11 w-[320px] items-center gap-2 rounded-full bg-sand px-4">
            <img src="/ui-icons/zoeken.svg" alt="" className="size-4" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek op naam, patiëntnummer of e-mail" className="w-full bg-transparent text-[14px] outline-none" />
          </div>
          {hits.length > 0 && (
            <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-[14px] bg-background p-2 shadow-lg ring-1 ring-mist">
              {hits.map((h) => (
                <button key={h.id} type="button" onClick={() => navigate({ to: "/patienten/$id", params: { id: String(h.patient_number ?? h.id) } })} className="flex w-full flex-col rounded-[10px] px-3 py-2 text-left hover:bg-sand">
                  <span className="text-[14px]">{h.first_name} {h.last_name}</span>
                  <span className="text-[12px] text-muted-foreground">{h.patient_number} · {h.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      } />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Vorige dag" onClick={() => setDay(addDays(day, -1))} className="flex size-9 items-center justify-center rounded-full bg-sand"><img src="/ui-icons/pijl-links.svg" alt="" className="size-4" /></button>
          <p className="whitespace-nowrap text-[15px] font-semibold">{day === today ? "Vandaag, " : ""}{label}</p>
          <button type="button" aria-label="Volgende dag" onClick={() => setDay(addDays(day, 1))} className="flex size-9 items-center justify-center rounded-full"><img src="/ui-icons/pijl-rechts.svg" alt="" className="size-4" /></button>
        </div>
        <div className="flex rounded-full bg-sand p-1">
          {([["created", "Aanmeldingen"], ["starting", "Afspraken"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={cn("whitespace-nowrap rounded-full px-4 py-2 text-[14px]", mode === k && "bg-background shadow-sm")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[[`Aanmeldingen ${day === today ? "vandaag" : "deze dag"}`, data?.created.length], [`Afspraken ${day === today ? "vandaag" : "deze dag"}`, data?.starting.length], ["Medische vragenlijst nog open", openQ], ["No-shows deze week", data?.noShows]].map(([l, v]) => (
          <div key={String(l)} className="rounded-[18px] bg-sand p-5"><p className="text-[13px] text-muted-foreground">{l}</p><p className="mt-1 text-[26px] font-semibold">{v ?? "–"}</p></div>
        ))}
      </div>
      <div className="flex gap-3">
        <Select className="w-56" label="Behandeling" value={treat} onChange={setTreat} options={[...all("Alle behandelingen"), ...ref.treatments.map((t) => ({ value: t.id, label: t.name_nl }))]} />
        <Select className="w-56" label="Locatie" value={loc} onChange={setLoc} options={[...all("Alle locaties"), ...ref.locations.map((l) => ({ value: l.id, label: l.name }))]} />
        <Select className="w-56" label="Behandelaar" value={prac} onChange={setPrac} options={[...all("Alle behandelaars"), ...ref.practitioners.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` }))]} />
      </div>
      <div className="overflow-x-auto">
        <DataTable count={shown.length} label="patiënten" loading={!data}><table className="w-full text-[14px]">
          <thead><tr className="border-b border-mist text-left text-[12px] text-muted-foreground">
            {["Patiëntnummer", "Naam", "Aangemeld", "Behandeling", "Afspraak", "Behandelaar", "Vragenlijst", "Bron"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-3 font-normal">{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map((a) => {
              const st = questionnaireState(a.treatment?.post_questionnaire_key, data?.sets ?? [], a.id);
              return (
                <tr key={a.id} className="border-b border-mist">
                  <td className="whitespace-nowrap px-2.5 py-3.5">{a.patient && <Link to="/patienten/$id" params={{ id: String(a.patient.patient_number ?? a.patient.id) }} className="font-semibold text-primary underline">{a.patient.patient_number}</Link>}</td>
                  <td className="whitespace-nowrap px-2.5">{a.patient ? `${a.patient.first_name} ${a.patient.last_name}` : ""}</td>
                  <td className="whitespace-nowrap px-2.5 text-muted-foreground">{hm(a.created_at)}</td>
                  <td className="whitespace-nowrap px-2.5">{a.treatment?.name_nl}</td>
                  <td className="whitespace-nowrap px-2.5">{dayShort(a.starts_at)}</td>
                  <td className="whitespace-nowrap px-2.5">{a.practitioner ? `${a.practitioner.first_name} ${a.practitioner.last_name}` : ""}</td>
                  <td className="whitespace-nowrap px-2.5">{st === "none" ? <span className="text-[12px] text-muted-foreground">Niet nodig</span> : st === "done" ? <span className="rounded-full bg-teal-light px-2.5 py-1 text-[12px] text-primary">Ingevuld</span> : <span className="rounded-full px-2.5 py-1 text-[12px] ring-1 ring-mist">Open</span>}</td>
                  <td className="whitespace-nowrap px-2.5 text-muted-foreground">{a.referral_source ?? a.source ?? ""}</td>
                </tr>
              );
            })}
            {data && shown.length === 0 && <tr><td colSpan={8} className="px-2.5 py-6 text-muted-foreground">Geen {mode === "created" ? "aanmeldingen" : "afspraken"} op deze dag.</td></tr>}
          </tbody>
        </table></DataTable>
      </div>
    </ListPage>
  );
}
