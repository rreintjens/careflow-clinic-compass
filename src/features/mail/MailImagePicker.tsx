import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PillButton } from "@/components/PillButton";
import { Modal } from "@/components/Modal";
import { mailImagesQuery } from "@/data/mail-images";
import { uploadMailImage } from "@/data/mail-images.functions";
import { MailImage } from "./MailImage";

async function fileContent(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const value = reader.result; typeof value === "string" ? resolve(value.slice(value.indexOf(",") + 1)) : reject(new Error("Afbeelding lezen is niet gelukt.")); };
    reader.onerror = () => reject(new Error("Afbeelding lezen is niet gelukt."));
    reader.readAsDataURL(file);
  });
}

export function MailImagePicker({ path, onChange }: { path: string; onChange: (path: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const images = useQuery({ ...mailImagesQuery, enabled: open });
  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (file.size > 5 * 1024 * 1024) throw new Error("Kies een JPG of PNG van maximaal 5 MB.");
      return uploadMailImage({ data: { content: await fileContent(file) } });
    },
    onSuccess: async (image) => { onChange(image.path); await qc.invalidateQueries({ queryKey: ["mail-images"] }); toast.success("Afbeelding toegevoegd"); },
    onError: (error) => toast.error(error.message),
  });
  return <>
    <div className="flex flex-wrap items-center gap-2">
      {path && <MailImage path={path} className="aspect-[5/2] w-24 rounded-[14px] object-cover" />}
      <PillButton size="sm" variant="outline" onClick={() => setOpen(true)}>Kies uit de beeldbank</PillButton>
      <PillButton size="sm" variant="outline" disabled={upload.isPending} onClick={() => input.current?.click()}>Upload eigen afbeelding</PillButton>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="hidden" aria-label="Upload eigen afbeelding" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload.mutate(file); e.target.value = ""; }} />
    </div>
    {open && <Modal open title="Kies uit de beeldbank" onOpenChange={setOpen} footer={<PillButton variant="outline" onClick={() => setOpen(false)}>Annuleren</PillButton>}>
      {images.isPending ? <div aria-busy>…</div> : images.error ? <p role="alert" className="text-warning">Afbeeldingen ophalen is niet gelukt.</p> : <div className="grid grid-cols-2 gap-3">
        {images.data?.map((image, i) => <PillButton key={image.name} variant="ghost" aria-label={`Afbeelding ${i + 1}`} className="h-auto rounded-[14px] p-1" onClick={() => { onChange(image.name); setOpen(false); }}><MailImage path={image.name} className="aspect-[5/2] w-full rounded-[14px] object-cover" /></PillButton>)}
      </div>}
    </Modal>}
  </>;
}