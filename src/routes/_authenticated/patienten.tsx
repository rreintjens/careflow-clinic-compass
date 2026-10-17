import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/patienten")({
  head: () => ({ meta: [{ title: "Patiënten · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Patiënten" phase={5} />;
}
