import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { PillButton } from "@/components/PillButton";
import { dossierQuery } from "@/data/patients";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DossierAddModal } from "@/features/dossier/DossierAddModal";

import { signalsOf } from "@/features/agenda/PatientCard";
import { ConsultMode, consultNoteQuery, useStartConsult } from "@/features/dossier/ConsultMode";

export const Route = createFileRoute("/_authenticated/patienten/$id")({
  head: () => ({ meta: [{ title: "Dossier · Beheer · The Body Clinic" }, { name: "description", content: "Het patiëntendossier van The Body Clinic." }, { property: "og:title", content: "Patiëntendossier · The Body Clinic" }, { property: "og:description", content: "Het patiëntendossier van The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dossierQuery(params.id)),
  component: Layout,
});

const TZ = "Europe/Amsterdam";
const ageOf = (dob: string) => { const [y, m, d] = dob.split("-").map(Number) as [number, number, number]; const n = new Date(); return n.getFullYear() - y - (n.getMonth() + 1 < m || (n.getMonth() + 1 === m && n.getDate() < d) ? 1 : 0); };
const TABS = [["/patienten/$id", "Overzicht"], ["/patienten/$id/tijdlijn", "Tijdlijn"], ["/patienten/$id/medisch", "Medisch"], ["/patienten/$id/behandeling", "Behandeling"], ["/patienten/$id/documenten", "Documenten"]] as const;

function Layout() {
  const { id } = Route.useParams();
  const [adding, setAdding] = useState(false);
  const { patient: p, appointments, sets } = useSuspenseQuery(dossierQuery(id)).data;
  const consultAppt = [...appointments].reverse().find((a) => a.status === "booked" && new Date(a.ends_at).getTime() > Date.now() - 12 * 3600_000);
  const { data: note } = useQuery({ ...consultNoteQuery(consultAppt?.id ?? ""), enabled: !!consultAppt });
  const startConsult = useStartConsult(id, consultAppt);
  if (!p) return <p className="text-muted-foreground">Dit dossier bestaat niet of je hebt er geen toegang toe.</p>;
  const now = Date.now();
  const next = [...appointments].reverse().find((a) => a.status === "booked" && new Date(a.ends_at).getTime() > now);
  const online = next?.location?.kind === "online";
  const signals = signalsOf(sets);
  const [d, mo, y] = [p.date_of_birth.slice(8, 10), p.date_of_birth.slice(5, 7), p.date_of_birth.slice(0, 4)];
  const nextDay = next && new Date(next.starts_at).toLocaleString("nl-NL", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(" om ", ", ");
  return (
    <div className="flex flex-col gap-6">
      {consultAppt && note?.status === "draft" && <ConsultMode patient={p} appt={consultAppt} />}
      <div className="flex items-end justify-between gap-4">
        <div><Link to="/patienten" className="text-[13px] text-primary">Patiënten</Link><h1 className="text-[28px] font-semibold tracking-tight">Dossier</h1></div>
        <div className="flex gap-2">
          {consultAppt && !note && <PillButton variant="outline" disabled={startConsult.isPending} onClick={() => startConsult.mutate()}>Start consult</PillButton>}
          <PillButton onClick={() => setAdding(true)}><img src="/ui-icons/plus.svg" alt="" className="size-4 invert" />Toevoegen</PillButton>
          <PillButton variant="outline" onClick={() => window.print()}>Afdrukken</PillButton>
          <PillButton variant="outline" disabled>Exporteren</PillButton>
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 rounded-[20px] bg-sand p-6">
        <div className="flex min-w-0 items-center gap-5">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-teal-light text-[20px] font-semibold text-primary">{p.first_name[0]}{p.last_name[0]}</div>
          <div className="min-w-0">
            <h2 className="text-[24px] font-semibold">{p.first_name} {p.last_name}</h2>
            <p className="text-[14px] text-muted-foreground">{[p.patient_number, `${d}-${mo}-${y}, ${ageOf(p.date_of_birth)} jaar`, p.phone, p.email, p.city].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {next?.treatment && <span className="whitespace-nowrap rounded-full bg-teal-light px-3 py-1 text-[12px] text-primary">{next.treatment.name_nl}</span>}
              {next?.new_patient && <span className="px-1 py-1 text-[12px]">Nieuw</span>}
              {signals.map((s) => <span key={s.item} className="whitespace-nowrap rounded-full bg-signal px-3 py-1 text-[12px] ring-1 ring-signal-border">{s.label}</span>)}
            </div>
          </div>
        </div>
        {next && (
          <div className="flex w-[290px] shrink-0 flex-col gap-1 rounded-[16px] bg-background p-4">
            <p className="text-[12px] text-muted-foreground">Volgende afspraak</p>
            <p className="text-[14px] font-semibold first-letter:uppercase">{nextDay}{online ? " · online" : ""}</p>
            <p className="text-[12px] text-muted-foreground">{next.treatment?.name_nl} · {next.practitioner?.first_name} {next.practitioner?.last_name}</p>
            {online && (next.meet_link
              ? <a href={next.meet_link} target="_blank" rel="noreferrer" className="mt-2"><PillButton size="lg" className="w-full">Start Google Meet</PillButton></a>
              : <PillButton size="lg" className="mt-2 w-full" disabled>Start Google Meet</PillButton>)}
          </div>
        )}
      </div>
      <nav className="flex gap-2 border-b border-mist">
        {TABS.map(([to, l]) => (
          <Link key={to} to={to} params={{ id }} activeOptions={{ exact: true }} className="whitespace-nowrap border-b-2 border-transparent px-4 py-3 text-[14px]" activeProps={{ className: "border-primary text-primary" }}>{l}</Link>
        ))}
      </nav>
      <Outlet />
      {adding && <DossierAddModal key={id} patient={p} onClose={() => setAdding(false)} />}
      <p className="text-[12px] text-muted-foreground">Elke weergave en wijziging staat in het technisch logboek.</p>
    </div>
  );
}
