import { ListPage,DataTable,RowChevron } from "@/components/ListPage";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from 'zod';

import { PageHeader } from "@/components/PageHeader";
import { patientDirectoryQuery } from "@/data/patients";
import { filterPatientDirectory } from '@/domain/patient-directory';

export const Route = createFileRoute("/_authenticated/patienten/")({
  validateSearch: z.object({ zoek: z.string().optional() }),
  head: () => ({ meta: [{ title: "Patiënten · Beheer · The Body Clinic" }, { name: "description", content: "Patiënten bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:title", content: "Patiënten · Beheer · The Body Clinic" }, { property: "og:description", content: "Patiënten bij The Body Clinic. Beheer en bekijk de bijbehorende gegevens." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(patientDirectoryQuery),
  errorComponent: () => <p role="alert">Patiënten laden is niet gelukt.</p>,
  notFoundComponent: () => <p>Geen patiënten gevonden.</p>,
  component: Page,
});

const dateLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('nl-NL', { timeZone: 'Europe/Amsterdam' }) : '–';

function Page() {
  const navigate = useNavigate();
  const { zoek: q = '' } = Route.useSearch();
  const { data } = useSuspenseQuery(patientDirectoryQuery);
  const shown = filterPatientDirectory(data, q);

  return (
    <ListPage>
      <PageHeader title="Patiënten" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-h-12 w-full max-w-xl items-center gap-3 rounded-full bg-sand px-5">
          <img src="/ui-icons/zoeken.svg" alt="" className="size-4 shrink-0" />
          <input aria-label="Zoek patiënten" value={q} onChange={e => void navigate({ to: '/patienten', search: { zoek: e.target.value || undefined }, replace: true })} placeholder="Naam, patiëntnummer, e-mail of telefoon" className="min-w-0 flex-1 bg-transparent text-[14px] outline-none" />
        </div>
        <span className="text-xs text-muted-foreground">{shown.length} patiënten</span>
      </div>
      <div className="overflow-x-auto">
        <DataTable count={shown.length} label="patiënten"><table className="w-full text-[14px]">
          <thead><tr className="border-b border-mist text-left text-[12px] text-muted-foreground">
            {["Patiëntnummer", "Naam", "Geboortedatum", "E-mail", "Telefoon", "Aangemeld", ""].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-3 font-normal">{h}</th>)}
          </tr></thead>
          <tbody>
            {shown.map(p => <tr key={p.id} className="border-b border-mist" onClick={() => void navigate({ to: '/patienten/$id', params: { id: String(p.patient_number ?? p.id) } })}>
              <td className="whitespace-nowrap px-2.5 py-3.5"><Link to="/patienten/$id" params={{ id: String(p.patient_number ?? p.id) }} className="font-semibold text-primary underline">{p.patient_number}</Link></td>
              <td className="whitespace-nowrap px-2.5">{p.first_name} {p.last_name}</td>
              <td className="whitespace-nowrap px-2.5">{dateLabel(p.date_of_birth)}</td>
              <td className="px-2.5">{p.email ?? '–'}</td>
              <td className="whitespace-nowrap px-2.5">{p.phone ?? '–'}</td>
              <td className="whitespace-nowrap px-2.5 text-muted-foreground">{dateLabel(p.created_at)}</td>
              <td className="px-2.5"><Link to="/patienten/$id" params={{ id: String(p.patient_number ?? p.id) }} aria-label={`Dossier van ${p.first_name} ${p.last_name}`}><RowChevron /></Link></td>
            </tr>)}
          </tbody>
        </table></DataTable>
      </div>
    </ListPage>
  );
}
