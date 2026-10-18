import { createFileRoute } from "@tanstack/react-router";
import { mailQuery } from "@/data/mail";
import { orgQuery } from "@/data/organisation";
import { MailManagement } from "@/features/mail/MailManagement";

export const Route = createFileRoute("/_authenticated/boekingsflow/e-mails/behandeling")({
  head: () => ({ meta: [{ title: "E-mails per behandeling · The Body Clinic" }, { name: "description", content: "Bekijk welke mails en behandelingsteksten gebruikt worden bij The Body Clinic." }, { property: "og:title", content: "E-mails per behandeling · The Body Clinic" }, { property: "og:description", content: "Overzicht van basissjablonen en specifieke afwijkingen per behandeling." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(mailQuery), context.queryClient.ensureQueryData(orgQuery)]); },
  component: () => <MailManagement treatmentView />,
});