import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patienten/$id/medisch")({ component: Tab });

function Tab() {
  return <section className="rounded-[20px] bg-sand p-6 text-[14px] text-muted-foreground">Medisch: volgt in de volgende stap.</section>;
}
