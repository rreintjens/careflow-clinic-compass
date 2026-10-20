import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/PageHeader";

const TITLE = "Adresboek · The Body Clinic";
const DESC = "Huisartsen en apotheken van je patiënten.";
export const Route = createFileRoute("/_authenticated/dossier/adresboek")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <PhasePlaceholder title="Adresboek" phase={5} />,
});
