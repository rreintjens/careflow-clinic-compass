import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { orgQuery, saveEquipmentKind, type Org } from "@/data/organisation";

/** Device kinds are managed under Behandelingen: a treatment requires kinds, not devices. */
export function EquipmentKindsModal({ org, onClose }: { org: Org; onClose: () => void }) {
  const qc = useQueryClient();
  const [names, setNames] = useState<Record<string, string>>(Object.fromEntries(org.equipmentKinds.map((k) => [k.id, k.name])));
  const [added, setAdded] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      for (const k of org.equipmentKinds) {
        const n = (names[k.id] ?? "").trim();
        if (n && n !== k.name) await saveEquipmentKind(k.id, { key: k.key, name: n, sort: k.sort });
      }
      const n = added.trim();
      if (n) {
        const key = n.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "soort";
        const unique = org.equipmentKinds.some((k) => k.key === key) ? `${key}_${org.equipmentKinds.length + 1}` : key;
        await saveEquipmentKind(null, { key: unique, name: n, sort: org.equipmentKinds.length + 1 });
      }
    },
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: orgQuery.queryKey }); toast.success("Opgeslagen"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Soorten apparatuur" description="Een behandeling vraagt een soort; elk apparaat heeft een soort."
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={() => save.mutate()}>Opslaan</PillButton></>}>
      <div className="flex flex-col gap-3">
        {org.equipmentKinds.map((k) => (
          <TextField key={k.id} label={`Soort ${k.sort}`} value={names[k.id] ?? ""} onChange={(e) => setNames({ ...names, [k.id]: e.target.value })} />
        ))}
        <TextField label="Nieuwe soort" value={added} onChange={(e) => setAdded(e.target.value)} />
      </div>
    </Modal>
  );
}
