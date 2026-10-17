import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/boekingsflow/boekingslinks")({
  head: () => ({ meta: [{ title: "Boekingslinks · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Boekingslinks" phase={6} />;
}
