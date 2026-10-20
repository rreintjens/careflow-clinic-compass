import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye } from "lucide-react";
import { readPortalAsPatient } from "@/data/portal.functions";
import { recordKey } from "@/data/patients";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/_authenticated/patienten/$id/portal")({
  head: () => ({ meta: [{ title: "Bekijk als patiënt · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: PortalPreview,
});

/** Read-only preview of Mijn omgeving as this patient (v0.1 §7). */
function PortalPreview() {
  const { id } = Route.useParams();
  const fn = useServerFn(readPortalAsPatient);
  const q = useQuery({ queryKey: ["portal-preview", id], queryFn: () => fn({ data: { patientId: id } }) });
  if (q.isLoading) return <div className="p-10 text-sm text-muted-foreground">Laden…</div>;
  if (q.error || !q.data) return <div className="p-10 text-sm text-muted-foreground">{q.error instanceof Error ? q.error.message : "Deze patiënt heeft nog geen Mijn omgeving."}</div>;
  const d = q.data;
  const history = (d.appointments ?? []).filter((a) => Date.parse(a.starts_at) < Date.now());
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-[16px] bg-signal px-5 py-3 text-[14px] ring-1 ring-signal-border">
        <Eye size={18} className="shrink-0" />
        <span>Je bekijkt Mijn omgeving als <strong>{d.patient.first_name} {d.patient.last_name}</strong>, alleen lezen.</span>
        <Link to="/patienten/$id" params={{ id: recordKey(d.patient) }} className="ml-auto text-primary underline underline-offset-2">Terug naar het dossier</Link>
      </div>
      <div className="portal pointer-events-none select-none rounded-[24px] ring-1 ring-mist" aria-readonly>
        <div className="portal-body">
          <header className="portal-topbar"><Logo mark /></header>
          <main className="portal-content">
            <p className="portal-date">{new Date(`${d.today}T12:00:00Z`).toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}</p>
            <h1>Welkom, <span>{d.patient.first_name}</span></h1>
            <div className="portal-start-grid">
              <div className="portal-tile"><span className="portal-tile-label">Landing</span><strong className="portal-tile-value portal-tile-value-long">{d.landing.kind}</strong></div>
              <div className="portal-tile"><span className="portal-tile-label">Behandelingen</span><strong className="portal-tile-value">{history.length}</strong></div>
              {d.weight !== null && <div className="portal-tile"><span className="portal-tile-label">Laatste gewicht</span><strong className="portal-tile-value">{d.weight} kg</strong></div>}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
