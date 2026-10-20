import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { ConsultPage } from "@/features/dossier/ConsultPage";
import { consultNoteQuery } from "@/features/dossier/ConsultMode";
import { dossierQuery } from "@/data/patients";

export const Route = createFileRoute("/_authenticated/patienten/$id/consult/$apptId")({
  head: () => ({ meta: [{ title: "Consult · Dossier · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(dossierQuery(params.id)),
  component: ConsultRoute,
});

/** The template-driven consult page for one appointment; the sticky bar and notes panel stay as they are. */
function ConsultRoute() {
  const { id, apptId } = Route.useParams();
  const { data: note, isLoading } = useQuery(consultNoteQuery(apptId));
  if (isLoading) return <p className="text-sm text-muted-foreground">Consult laden…</p>;
  if (!note) {
    return (
      <div className="flex flex-col gap-3">
        <Link to="/patienten/$id" params={{ id }} className="text-[13px] text-primary">Dossier</Link>
        <h1 className="text-[28px] font-semibold tracking-tight">Consult</h1>
        <p className="text-sm text-muted-foreground">Er loopt geen consult voor deze afspraak. Start het consult vanuit het dossier.</p>
      </div>
    );
  }
  return <ConsultPage noteId={note.id} />;
}
