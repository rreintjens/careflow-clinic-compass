import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/organisatie/behandelingen")({
  head: () => ({ meta: [{ title: "Behandelingen · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Behandelingen" phase={2} />;
}
