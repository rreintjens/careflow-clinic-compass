import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { supabase } from "@/integrations/supabase/client";

async function bucket() {
  const { data } = await supabase.rpc("current_tenant_slug");
  return `patient-documents-${data}`;
}

export function DocumentModal({ id, onClose }: { id: string; onClose: () => void }) {
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
