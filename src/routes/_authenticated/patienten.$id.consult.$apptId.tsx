import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patienten/$id/consult/$apptId")({
  head:()=>({meta:[{title:'Consultdossier · The Body Clinic'},{name:'description',content:'Consult openen in het patiëntdossier van The Body Clinic.'},{property:'og:title',content:'Consultdossier · The Body Clinic'},{property:'og:description',content:'Consult openen in het patiëntdossier van The Body Clinic.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex'}]}),
  beforeLoad: ({ params }) => { throw redirect({ to: '/patienten/$id', params: { id: params.id }, replace: true }); },
});
