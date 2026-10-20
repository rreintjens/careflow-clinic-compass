import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { TextLink } from "@/components/Field";
import { patientPhotosQuery } from "@/data/consult-steps";
import { shareConsultPhoto } from "@/data/consult-steps.functions";
import { dossierQuery } from "@/data/patients";
import { formatClinicalDate } from "@/domain/time";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/patienten/$id/fotos")({
  head: () => ({ meta: [{ title: "Foto's · Dossier · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: Photos,
});

/** All consult photos of this patient, newest first, with share toggles for Mijn omgeving. */
function Photos() {
  const { id: key } = Route.useParams();
  const qc = useQueryClient();
  const id = useSuspenseQuery(dossierQuery(key)).data.patient?.id ?? "";
  const { data: photos = [] } = useQuery(patientPhotosQuery(id));
  const [selected, setSelected] = useState<string | null>(null);
  const share = async (photoId: string, v: boolean) => {
    try {
      await shareConsultPhoto({ data: { photoId, share: v } });
      toast.success(v ? "Gedeeld met de patiënt" : "Niet meer gedeeld");
      void qc.invalidateQueries({ queryKey: ["patient-photos", id] });
    } catch (e) { toast.error((e as Error).message); }
  };
  const current = photos.find((p) => p.id === selected);
  return (
    <section className="rounded-[20px] p-6 ring-1 ring-mist">
      <h3 className="text-[17px] font-semibold">Foto's</h3>
      <p className="text-[13px] text-muted-foreground">Alle foto's uit consulten van deze patiënt</p>
      {photos.length === 0 && <p className="mt-5 text-[14px] text-muted-foreground">Nog geen foto's. Foto's maak je tijdens het consult met de telefoon van de behandelaar of patiënt.</p>}
      <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="flex flex-col gap-2">
            <button type="button" onClick={() => setSelected(p.id)} className="flex h-40 items-center justify-center overflow-hidden rounded-[14px] bg-sand">
              <img src={p.image} alt={`Foto ${p.slot}`} className="size-full object-cover" />
            </button>
            <p className="text-[12px] text-muted-foreground">{p.slot} · {formatClinicalDate(p.created_at, true)}{p.shared_with_patient ? " · gedeeld" : ""}</p>
          </div>
        ))}
      </div>
      {current && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-6" role="dialog" aria-label="Foto bekijken" onClick={() => setSelected(null)}>
          <div className="max-h-full w-full max-w-2xl rounded-[20px] bg-background p-6" onClick={(e) => e.stopPropagation()}>
            <img src={current.image} alt={`Foto ${current.slot}`} className="max-h-[60vh] w-full rounded-[14px] object-contain" />
            <div className="mt-4 flex items-center gap-4">
              <p className="flex-1 text-[13px] text-muted-foreground">{current.slot} · {formatClinicalDate(current.created_at, true)}</p>
              <a href={current.image} download={`foto-${current.slot}.png`} className="text-[13px] text-primary underline">Download</a>
              <TextLink onClick={() => void share(current.id, !current.shared_with_patient)}>{current.shared_with_patient ? "Niet meer delen" : "Deel met patiënt"}</TextLink>
              <TextLink onClick={() => setSelected(null)}>Sluiten</TextLink>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
