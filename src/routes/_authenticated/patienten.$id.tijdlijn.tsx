import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { standaloneConsultsQuery } from "@/data/consults";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { dossierQuery } from "@/data/patients";
import { buildTimeline, type TimelineKind } from "@/features/dossier/timeline";
import { TimelineList } from "@/features/dossier/TimelineList";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/patienten/$id/tijdlijn")({ head: () => ({ meta: [{ title: "Tijdlijn · Dossier · The Body Clinic" }, { name: "description", content: "Afspraken en consulten chronologisch in het patiëntendossier." }, { property: "og:title", content: "Tijdlijn · The Body Clinic" }, { property: "og:description", content: "Afspraken en consulten chronologisch in het patiëntendossier." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Timeline });

const FILTERS: Array<[TimelineKind | "all", string]> = [["all", "Alles"], ["appointments", "Afspraken en consulten"], ["questionnaires", "Vragenlijsten"], ["contact", "E-mails en contact"], ["treatment", "Behandeling en metingen"], ["system", "Systeem"]];

function Timeline() {
  const { id } = Route.useParams();
  const d = useSuspenseQuery(dossierQuery(id)).data;
  const { data: consults = [] } = useQuery(standaloneConsultsQuery(id));
  const [f, setF] = useState<TimelineKind | "all">("all");
  const events = buildTimeline(d, consults).filter((e) => f === "all" || e.kind === f);
  return (
    <section className="rounded-[20px] p-6 ring-1 ring-mist">
      <h3 className="text-[17px] font-semibold">Tijdlijn</h3>
      <p className="text-[13px] text-muted-foreground">Alles wat er met en voor deze patiënt gebeurde, in volgorde</p>
      <div className="my-5 flex gap-2 overflow-x-auto">
        {FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => setF(k)} className={cn("whitespace-nowrap rounded-full px-3.5 py-2 text-[13px]", f === k ? "bg-primary text-primary-foreground" : "bg-sand")}>{l}</button>)}
      </div>
      <TimelineList events={events} />
    </section>
  );
}
