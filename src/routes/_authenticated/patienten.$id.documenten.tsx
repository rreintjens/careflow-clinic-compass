import { DocumentModal } from "@/features/dossier/DocumentModal";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { PillButton } from "@/components/PillButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/patienten/$id/documenten")({ head: () => ({ meta: [{ title: "Documenten · Dossier · The Body Clinic" }, { name: "description", content: "Documenten in het patiëntendossier van The Body Clinic." }, { property: "og:title", content: "Dossierdocumenten · The Body Clinic" }, { property: "og:description", content: "Documenten in het patiëntendossier van The Body Clinic." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }), component: Documents });

const day = (s: string) => new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" });

async function bucket() {
  const { data } = await supabase.rpc("current_tenant_slug");
  return `patient-documents-${data}`;
}

function Documents() {
  const { id } = Route.useParams();
  const [open, setOpen] = useState(false);
  const { data: docs = [] } = useQuery({
    queryKey: ["documents", id],
    queryFn: async () => (await supabase.from("patient_documents").select("*").eq("patient_id", id).order("created_at")).data ?? [],
  });
  const download = async (path: string) => {
    const { data, error } = await supabase.storage.from(await bucket()).createSignedUrl(path, 60);
    if (error || !data) { toast.error("Openen is niet gelukt"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  };
  return (
    <section className="rounded-[20px] p-6 ring-1 ring-mist">
      <h3 className="text-[17px] font-semibold">Documenten</h3>
      <table className="mt-4 w-full text-[14px]">
        <thead><tr className="border-b border-mist text-left text-[12px] text-muted-foreground">{["Datum", "Document", "Bron"].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2.5 font-normal">{h}</th>)}</tr></thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-b border-mist">
              <td className="whitespace-nowrap px-2.5 py-3">{d.storage_path ? day(d.created_at) : "–"}</td>
              <td className="px-2.5">{d.storage_path ? <button type="button" onClick={() => download(d.storage_path ?? "")} className="text-left text-primary underline">{d.title}</button> : d.title}</td>
              <td className="whitespace-nowrap px-2.5 text-muted-foreground">{d.source === "system" ? "Systeem" : d.storage_path ? "Medewerker" : "nog te uploaden door patiënt of arts"}</td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={3} className="px-2.5 py-4 text-muted-foreground">Nog geen documenten.</td></tr>}
        </tbody>
      </table>
      <PillButton variant="outline" className="mt-4" onClick={() => setOpen(true)}>Document toevoegen</PillButton>
      {open && <DocumentModal id={id} onClose={() => setOpen(false)} />}
    </section>
  );
}

