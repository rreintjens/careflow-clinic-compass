import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patienten/$id/consult/$apptId")({
  beforeLoad: ({ params }) => { throw redirect({ to: '/patienten/$id', params: { id: params.id }, replace: true }); },
});
