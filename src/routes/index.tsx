import { createFileRoute, redirect } from "@tanstack/react-router";

// The patient booking flow arrives in phase 4; until then / opens staff sign-in.
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Body Clinic · Agenda en dossier" },
      { name: "description", content: "Agenda en dossier voor medewerkers van The Body Clinic." },
      { property: "og:title", content: "The Body Clinic · Agenda en dossier" },
      { property: "og:description", content: "Agenda en dossier voor medewerkers van The Body Clinic." },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
});
