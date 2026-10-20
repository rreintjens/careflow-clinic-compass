import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { TextArea } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { dossierRowAction } from "@/data/consult-steps.functions";

/** Row actions on a consult in the dossier: duplicate for a repeat treatment, archive, or delete (superadmin, with reason). */
export function DossierActionModal({ noteId, onClose }: { noteId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const mut = useMutation({
    mutationFn: (action: "duplicate" | "archive" | "delete") => dossierRowAction({ data: { noteId, action, reason: reason || undefined } }),
    onSuccess: (_d, action) => {
      toast.success(action === "duplicate" ? "Consult gedupliceerd als basis voor een herhaalbehandeling" : action === "archive" ? "Consult gearchiveerd" : "Consult verwijderd");
      void qc.invalidateQueries();
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Consultacties" description="Deze acties staan in het logboek."
      footer={<PillButton variant="outline" onClick={onClose}>Sluiten</PillButton>}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-sand px-4 py-3">
          <div><p className="text-[14px] font-medium">Dupliceer voor herhaalbehandeling</p><p className="text-[12px] text-muted-foreground">Maakt een kopie als startpunt van een nieuw consult.</p></div>
          <PillButton size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("duplicate")}>Dupliceer</PillButton>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-[14px] bg-sand px-4 py-3">
          <div><p className="text-[14px] font-medium">Archiveer</p><p className="text-[12px] text-muted-foreground">Het consult blijft bewaard maar valt buiten de standaardweergave.</p></div>
          <PillButton size="sm" variant="outline" disabled={mut.isPending} onClick={() => mut.mutate("archive")}>Archiveer</PillButton>
        </div>
        <div className="rounded-[14px] bg-sand px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[14px] font-medium">Verwijder</p><p className="text-[12px] text-muted-foreground">Alleen met een reden, en alleen door een beheerder.</p></div>
            {!deleting && <PillButton size="sm" variant="outline" onClick={() => setDeleting(true)}>Verwijder…</PillButton>}
          </div>
          {deleting && (
            <div className="mt-3 flex flex-col gap-3">
              <TextArea label="Reden (verplicht)" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="flex gap-2">
                <PillButton size="sm" disabled={!reason.trim() || mut.isPending} onClick={() => mut.mutate("delete")}>Definitief verwijderen</PillButton>
                <PillButton size="sm" variant="outline" onClick={() => setDeleting(false)}>Annuleren</PillButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
