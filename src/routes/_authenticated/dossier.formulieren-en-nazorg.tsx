import { createFileRoute } from "@tanstack/react-router";
import { PhasePlaceholder } from "@/components/PageHeader";

const TITLE = "Formulieren en nazorg · The Body Clinic";
const DESC = "Toestemmingsformulieren en nazorgteksten voor Mijn omgeving.";
export const Route = createFileRoute("/_authenticated/dossier/formulieren-en-nazorg")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <PhasePlaceholder title="Formulieren en nazorg" phase={5} />,
});
