import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/patienten/$id/documenten")({ component: Documents });

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
              <td className="px-2.5">{d.storage_path ? <button type="button" onClick={() => download(d.storage_path!)} className="text-left text-primary underline">{d.title}</button> : d.title}</td>
              <td className="whitespace-nowrap px-2.5 text-muted-foreground">{d.source === "system" ? "Systeem" : d.storage_path ? "Medewerker" : "nog te uploaden door patiënt of arts"}</td>
            </tr>
          ))}
          {docs.length === 0 && <tr><td colSpan={3} className="px-2.5 py-4 text-muted-foreground">Nog geen documenten.</td></tr>}
        </tbody>
      </table>
      <PillButton variant="outline" className="mt-4" onClick={() => setOpen(true)}>Document toevoegen</PillButton>
      {open && <AddModal id={id} onClose={() => setOpen(false)} />}
    </section>
  );
}

function AddModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const save = useMutation({
    mutationFn: async () => {
      let path: string | null = null;
      if (file) {
        path = `${id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
        const up = await supabase.storage.from(await bucket()).upload(path, file);
        if (up.error) throw up.error;
      }
      const r = await supabase.from("patient_documents").insert({ patient_id: id, title: title.trim(), storage_path: path });
      if (r.error) throw r.error;
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["documents", id] }); toast.success("Document toegevoegd"); onClose(); },
    onError: () => toast.error("Toevoegen is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Document toevoegen" footer={<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!title.trim() || save.isPending} onClick={() => save.mutate()}>Toevoegen</PillButton></div>}>
      <div className="flex flex-col gap-4">
        <TextField label="Naam" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input ref={input} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <div className="flex items-center gap-3"><PillButton variant="outline" onClick={() => input.current?.click()}>Bestand kiezen</PillButton><span className="text-[13px] text-muted-foreground">{file ? file.name : "Zonder bestand: komt in de lijst als nog te uploaden"}</span></div>
      </div>
    </Modal>
  );
}
