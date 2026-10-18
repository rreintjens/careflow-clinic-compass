import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patienten/$id/behandeling")({ component: Tab });

function Tab() {
  return <section className="rounded-[20px] bg-sand p-6 text-[14px] text-muted-foreground">Behandeling: volgt in de volgende stap.</section>;
}
