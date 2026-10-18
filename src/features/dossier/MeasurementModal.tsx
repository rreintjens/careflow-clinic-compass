import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { saveMeasurement } from "@/data/measurements.functions";
import { measurementSchema } from "@/domain/measurements";

export function MeasurementModal({ id, height, onClose }: { id: string; height: number | null; onClose: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveMeasurement);
  const [f, setF] = useState({ date: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }), weight: "", height: height === null ? "" : String(height), waist: "", sys: "", dia: "", pulse: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const save = useMutation({
    mutationFn: () => saveFn({ data: measurementSchema.parse({ patientId: id, ...f }) }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["measurements", id] }); toast.success("Meting toegevoegd"); onClose(); },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const fld = (k: keyof typeof f, label: string) => <TextField label={label} inputMode="decimal" aria-invalid={errors.includes(k)} help={errors.includes(k) ? "Vul een geldig getal in" : undefined} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />;
  const submit = () => { const result = measurementSchema.safeParse({ patientId: id, ...f }); if (!result.success) { setErrors(result.error.issues.map((i) => String(i.path[0]))); return; } setErrors([]); save.mutate(); };
  return (
    <Modal open onOpenChange={(o) => !o && onClose()} title="Meting toevoegen" footer={<div className="flex gap-2"><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={save.isPending} onClick={submit}>Toevoegen</PillButton></div>}>
      <div className="grid grid-cols-2 gap-4">
        <TextField label="Datum" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        {fld("height", "Lengte (cm)")}{fld("weight", "Gewicht (kg)")}{fld("waist", "Buikomvang (cm)")}{fld("pulse", "Pols")}{fld("sys", "Bloeddruk boven")}{fld("dia", "Bloeddruk onder")}
      </div>
    </Modal>
  );
}
