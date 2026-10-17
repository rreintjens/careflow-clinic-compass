import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/boekingsflow/vragenlijsten")({
  head: () => ({ meta: [{ title: "Vragenlijsten · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Vragenlijsten" phase={3} />;
}
