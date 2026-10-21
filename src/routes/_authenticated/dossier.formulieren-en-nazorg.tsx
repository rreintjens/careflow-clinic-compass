import { createFileRoute } from "@tanstack/react-router";
import { CareFormManagement } from '@/features/questionnaire/CareFormManagement';
import { careFormsQuery, careFormKindsQuery } from '@/data/care-forms';
import { templatesQuery } from '@/data/dossier';

const TITLE = "Formulieren en nazorg · The Body Clinic";
const DESC = "Toestemmingsformulieren en nazorgteksten voor Mijn omgeving.";
export const Route = createFileRoute("/_authenticated/dossier/formulieren-en-nazorg")({
  head: () => ({ meta: [{ title: TITLE }, { name: "description", content: DESC }, { property: "og:title", content: TITLE }, { property: "og:description", content: DESC }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: ({context})=>Promise.all([context.queryClient.ensureQueryData(careFormsQuery),context.queryClient.ensureQueryData(careFormKindsQuery),context.queryClient.ensureQueryData(templatesQuery)]),
  component: CareFormManagement,
});
