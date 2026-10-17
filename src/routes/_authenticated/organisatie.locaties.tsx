import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/organisatie/locaties")({
  head: () => ({ meta: [{ title: "Locaties · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Locaties" phase={2} />;
}
