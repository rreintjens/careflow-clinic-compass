import { createFileRoute } from "@tanstack/react-router";

import { PhasePlaceholder } from "@/components/PageHeader";

export const Route = createFileRoute("/_authenticated/instellingen/koppelingen")({
  head: () => ({ meta: [{ title: "Koppelingen · Beheer · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Page,
});

function Page() {
  return <PhasePlaceholder title="Koppelingen" phase={6} />;
}
