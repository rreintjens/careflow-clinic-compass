import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { TextField, TextLink } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MultiSelect } from "@/components/MultiSelect";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { deleteEquipmentKind, orgQuery, saveEquipmentKind, type Org } from "@/data/organisation";
import { kindDeleteBlocker } from "@/domain/equipment";
import { kindOfType } from "@/features/organisation/devices";
import { cn } from "@/lib/utils";

type Kind = Org["equipmentKinds"][number];

const usage = (org: Org, k: Kind) => {
  const treatmentIds = [...new Set(org.requirements.filter((r) => r.kind === "equipment" && r.equipment_kind === k.key).map((r) => r.treatment_id))];
  return {
    treatmentIds,
    devices: org.equipment.filter((d) => (kindOfType(org, d.type_id)?.id ?? null) === k.id).length,
    children: org.equipmentKinds.filter((c) => c.parent_id === k.id),
  };
};

function requiredBy(org: Org, k: Kind, treatmentIds: string[]) {
  const names = treatmentIds.map((id) => org.treatments.find((t) => t.id === id)?.name_nl).filter(Boolean) as string[];
  const parent = org.equipmentKinds.find((p) => p.id === k.parent_id);
  if (!names.length) return parent ? `Hoort bij ${parent.name.toLowerCase()}; geen eigen behandeling` : "geen behandeling";
  return names.length > 2 ? `${names[0]}, ${names.length - 1} andere` : names.join(", ");
}

/** Device kinds: list with usage, edit per row, and "Nieuwe soort" at the bottom. */
export function EquipmentKindsModal({ org, onClose, onCreated }: { org: Org; onClose: () => void; onCreated?: (kindId: string) => void }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Kind | null>(null);
  const [name, setName] = useState("");
  const [treatments, setTreatments] = useState<string[]>([]);
  const [parent, setParent] = useState("none");
  const [blocker, setBlocker] = useState<string | null>(null);

  const startEdit = (k: Kind | null) => {
    setEditing(k);
    setName(k?.name ?? "");
    setTreatments(k ? usage(org, k).treatmentIds : []);
    setParent(k?.parent_id ?? "none");
    setBlocker(null);
  };
  const refresh = () => qc.invalidateQueries({ queryKey: orgQuery.queryKey });

  const save = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      const base = n.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "soort";
      const key = editing?.key ?? (org.equipmentKinds.some((k) => k.key === base) ? `${base}_${org.equipmentKinds.length + 1}` : base);
      await saveEquipmentKind(org, editing?.id ?? null, { key, name: n, sort: editing?.sort ?? org.equipmentKinds.length + 1, parent_id: parent === "none" ? null : parent }, treatments);
      return key;
    },
    onSuccess: async (key) => {
      await refresh();
      toast.success(editing ? "Soort opgeslagen" : "Soort toegevoegd");
      const created = !editing;
      startEdit(null);
      if (created && onCreated) {
        const k = qc.getQueryData(orgQuery.queryKey)?.equipmentKinds.find((x) => x.key === key);
        if (k) onCreated(k.id);
      }
    },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const del = useMutation({
    mutationFn: () => deleteEquipmentKind(editing?.id ?? ""),
    onSuccess: async () => { await refresh(); toast.success("Soort verwijderd"); startEdit(null); },
    onError: () => toast.error("Verwijderen is niet gelukt"),
  });
  const tryDelete = () => {
    if (!editing) return;
    const u = usage(org, editing);
    const why = kindDeleteBlocker({ treatments: u.treatmentIds.length, devices: u.devices, children: u.children.length });
    if (why) setBlocker(why);
    else del.mutate();
  };

  const parentOptions = [{ value: "none", label: "Zelfstandig" }, ...org.equipmentKinds.filter((k) => k.id !== editing?.id && !k.parent_id).map((k) => ({ value: k.id, label: k.name }))];

  return (
    <Modal open onOpenChange={(o) => !o && onClose()} width="lg" title="Soorten apparatuur" description={`${org.equipmentKinds.length} soorten · gebruikt in Behandelingen en Apparatuur`}
      footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton onClick={onClose}>Sluiten</PillButton></>}>
      <p className="text-[13px] leading-[1.6]">Een soort is wat een behandeling nodig heeft, los van merk of exemplaar. Een soort verwijderen kan alleen als geen behandeling en geen apparaat hem gebruikt.</p>
      <div className="mt-4 flex flex-col gap-2">
        {org.equipmentKinds.map((k) => {
          const u = usage(org, k);
          return (
            <div key={k.id} className={cn("flex items-center gap-3 rounded-[12px] bg-sand px-3 py-2.5", editing?.id === k.id && "ring-1 ring-primary")}>
              <div className="min-w-0 flex-1">
                <div className="truncate whitespace-nowrap text-sm">{k.name}</div>
                <div className="truncate whitespace-nowrap text-xs text-muted-foreground">{u.devices} {u.devices === 1 ? "apparaat" : "apparaten"} · vereist door {requiredBy(org, k, u.treatmentIds)}</div>
              </div>
              <TextLink onClick={() => startEdit(k)}>Wijzig</TextLink>
            </div>
          );
        })}
      </div>
      <div className="mt-5 rounded-[16px] border border-primary p-4">
        <div className="text-[13px] font-semibold">{editing ? `${editing.name} wijzigen` : "Nieuwe soort"}</div>
        <TextField className="mt-3" label="Naam" placeholder="Bijvoorbeeld: Microneedling-apparaat" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <MultiSelect label="Vereist door behandelingen" value={treatments} onChange={setTreatments} options={org.treatments.map((t) => ({ value: t.id, label: t.name_nl }))} help="Zo weet de planner meteen waar die behandelingen boekbaar zijn." />
          <Select label="Hoort bij" value={parent} onChange={setParent} options={parentOptions} help="Of: hoort bij een andere soort, zoals rookafzuiging bij laser." />
        </div>
        {blocker && <p className="mt-3 rounded-[12px] bg-warning-light px-3 py-2 text-[13px] text-warning">{blocker}</p>}
        <div className="mt-4 flex items-center justify-between">
          {editing ? <TextLink tone="warning" onClick={tryDelete}>Soort verwijderen</TextLink> : <span />}
          <div className="flex gap-2">
            <PillButton variant="outline" onClick={() => startEdit(null)}>Annuleren</PillButton>
            <PillButton disabled={!name.trim() || save.isPending} onClick={() => save.mutate()}>{editing ? "Opslaan" : "Soort toevoegen"}</PillButton>
          </div>
        </div>
      </div>
    </Modal>
  );
}
