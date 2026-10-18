import { createFileRoute } from "@tanstack/react-router";

import { mailQuery } from "@/data/mail";
import { orgQuery } from "@/data/organisation";
import { MailManagement } from "@/features/mail/MailManagement";

export const Route = createFileRoute("/_authenticated/boekingsflow/e-mails")({
  head: () => ({ meta: [{ title: "E-mails en sjablonen · The Body Clinic" }, { name: "description", content: "Beheer afspraakmails, voorwaarden en afwijkingen per behandeling bij The Body Clinic." }, { property: "og:title", content: "E-mails en sjablonen · The Body Clinic" }, { property: "og:description", content: "Beheer afspraakmails per moment en behandeling." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(mailQuery), context.queryClient.ensureQueryData(orgQuery)]); },
  component: Page,
});

function Page() {
  return <MailManagement />;
}
