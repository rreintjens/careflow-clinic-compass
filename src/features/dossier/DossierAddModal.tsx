import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { agendaRefQuery } from "@/data/agenda";
import type { Dossier } from "@/data/patients";
import { staffContextQuery } from "@/data/staff";
import { measurementsQuery } from "@/data/measurements";
import { supabase } from "@/integrations/supabase/client";
import { NewAppointmentModal } from "@/features/agenda/NewAppointmentModal";
import { DocumentModal } from "./DocumentModal";
import { MeasurementModal } from "./MeasurementModal";
import { StandaloneConsultModal } from "./StandaloneConsultModal";

export function DossierAddModal({ patient, onClose }: { patient: NonNullable<Dossier["patient"]>; onClose: () => void }) {
  const [action, setAction] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data: staff } = useQuery(staffContextQuery);
  const { data: agenda, isError } = useQuery({ ...agendaRefQuery, enabled: action === "appointment" });
  const { data: measurements = [] } = useQuery({ ...measurementsQuery(patient.id), enabled: action === "measurement" });
  const { data: choices = [] } = useQuery({
    queryKey: ["dossier-add-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("option_lists").select("list_key,value,label_nl").in("list_key", ["dossier_add_action", "dossier_add_help"]).order("sort");
      if (error) throw error;
      return data;
    },
  });
  const permitted = (value: string) => {
    const permission = value === "appointment" ? "agenda.write" : "patients.medical";
    return staff?.permissions?.includes(permission) ?? false;
  };
  if (action === "consult") return <StandaloneConsultModal patientId={patient.id} onClose={onClose} />;
  if (action === "measurement") return <MeasurementModal id={patient.id} height={measurements.filter((m) => m.height_cm !== null).at(-1)?.height_cm ?? null} onClose={onClose} />;
  if (action === "document") return <DocumentModal id={patient.id} onClose={onClose} />;
  if (action === "appointment" && agenda) return <NewAppointmentModal open onOpenChange={(open) => !open && onClose()} data={agenda} fixedPatient={patient} onPickInAgenda={() => { onClose(); void navigate({ to: "/agenda" }); }} />;
  return <Modal open width="lg" title={`Toevoegen aan het dossier van ${patient.first_name} ${patient.last_name}`} onOpenChange={(open) => !open && onClose()}
    footer={<PillButton variant="outline" onClick={onClose}>Annuleren</PillButton>}>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {choices.filter((c) => c.list_key === "dossier_add_action").map((choice) => {
        const unavailable = choice.value === "contact" || choice.value === "request";
        const disabled = unavailable || !permitted(choice.value);
        return <PillButton key={choice.value} variant="outline" disabled={disabled || action === "appointment"} title={unavailable ? "Het invoerscherm ontbreekt in het ontwerppakket" : disabled ? "Je hebt geen toegang tot deze actie" : choice.label_nl}
          className="h-auto min-h-24 items-start justify-start whitespace-normal rounded-[14px] px-4 py-3 text-left" onClick={() => setAction(choice.value)}>
          <span className="flex flex-col gap-1"><span className="text-[14px]">{choice.label_nl}</span><span className="text-[12px] font-normal text-muted-foreground">{choices.find((c) => c.list_key === "dossier_add_help" && c.value === choice.value)?.label_nl}</span></span>
        </PillButton>;
      })}
    </div>
    {action === "appointment" && <p role="status" className="mt-4 text-sm text-muted-foreground">{isError ? "Laden is niet gelukt" : "Laden…"}</p>}
  </Modal>;
}