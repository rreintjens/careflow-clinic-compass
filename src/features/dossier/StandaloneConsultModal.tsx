import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { TextArea, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { PillButton } from "@/components/PillButton";
import { Select } from "@/components/Select";
import { standaloneConsultOptionsQuery } from "@/data/consults";
import { saveStandaloneConsult } from "@/data/consults.functions";
import { standaloneConsultSchema, type StandaloneConsultInput } from "@/domain/consult";

export function StandaloneConsultModal({ patientId, practitionerId, onClose }: { patientId: string; practitionerId?: string | undefined; onClose: () => void }) {
  const { data, isError } = useQuery(standaloneConsultOptionsQuery);
  const saveFn = useServerFn(saveStandaloneConsult);
  const qc = useQueryClient();
  const { register, setValue, watch, handleSubmit, formState: { errors } } = useForm<StandaloneConsultInput>({
    resolver: zodResolver(standaloneConsultSchema),
    defaultValues: { patientId, practitionerId: practitionerId ?? "", kind: "", date: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Amsterdam" }), timeAndDuration: "", reason: "", subjective: "", objective: "", evaluation: "", plan: "", followUp: "", visibility: "" },
  });
  const save = useMutation({
    mutationFn: (input: StandaloneConsultInput) => saveFn({ data: input }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["treatment-tab", patientId] }), qc.invalidateQueries({ queryKey: ["standalone-consults", patientId] })]);
      toast.success("Opgeslagen"); onClose();
    },
    onError: () => toast.error("Opslaan is niet gelukt"),
  });
  const options = (key: string) => data?.options.filter((o) => o.list_key === key).map((o) => ({ value: o.value, label: o.label_nl })) ?? [];
  const select = (field: "kind" | "practitionerId" | "followUp" | "visibility", label: string, choices: Array<{ value: string; label: string }>) => <Select label={label} value={watch(field)} onChange={(value) => setValue(field, value, { shouldValidate: true })} options={choices} />;
  return <Modal open width="lg" title="Telefonisch consult vastleggen" onOpenChange={(open) => !open && onClose()}
    footer={<><PillButton variant="outline" onClick={onClose}>Annuleren</PillButton><PillButton disabled={!data || save.isPending} onClick={() => void handleSubmit((input) => save.mutate(input), () => { document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); })()}>Opslaan</PillButton></>}>
    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={handleSubmit((input) => save.mutate(input))}>
      {select("kind", "Soort", options("standalone_consult_kind"))}
      {select("practitionerId", "Behandelaar", data?.practitioners.map((p) => ({ value: p.id, label: `${p.first_name} ${p.last_name}` })) ?? [])}
      <TextField label="Datum" type="date" aria-invalid={!!errors.date} {...register("date")} />
      <TextField label="Tijd en duur" aria-invalid={!!errors.timeAndDuration} {...register("timeAndDuration")} />
      <TextArea label="Aanleiding" className="sm:col-span-2" {...register("reason")} />
      <TextArea label="Subjectief" {...register("subjective")} /><TextArea label="Objectief" {...register("objective")} />
      <TextArea label="Evaluatie" {...register("evaluation")} /><TextArea label="Plan" {...register("plan")} />
      {select("followUp", "Vervolgactie", options("standalone_consult_follow_up"))}
      {select("visibility", "Zichtbaar voor", options("standalone_consult_visibility"))}
      {(Object.keys(errors).length > 0 || isError) && <p role="alert" className="text-warning sm:col-span-2">{isError ? "Laden is niet gelukt" : "Vul de ontbrekende velden in"}</p>}
    </form>
  </Modal>;
}