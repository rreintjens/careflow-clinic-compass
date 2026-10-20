import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { PillButton } from "@/components/PillButton";
import { UiIcon } from "@/components/UiIcon";
import { uploadConsultPhoto } from "@/data/consult-steps.functions";

export const Route = createFileRoute("/foto/$token")({
  head: () => ({ meta: [{ title: "Foto uploaden · The Body Clinic" }, { name: "robots", content: "noindex" }] }),
  component: PhotoUpload,
});

/** Public upload page behind a 10-minute token: no login, one photo per link. */
function PhotoUpload() {
  const { token } = Route.useParams();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const image = await shrink(file);
      await uploadConsultPhoto({ data: { token, image } });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand p-6">
      <div className="w-full max-w-md rounded-[20px] bg-background p-8 text-center shadow-[0_8px_24px_rgba(57,51,46,0.10)]">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-teal-light text-primary"><UiIcon name={done ? "vinkje" : "mobiel"} className="size-5" /></span>
        <h1 className="text-[22px] font-semibold tracking-tight">{done ? "Foto ontvangen" : "Maak een foto"}</h1>
        {done ? (
          <p className="mt-2 text-[14px] text-muted-foreground">De foto staat nu in het dossier van je behandelaar. Je kunt dit scherm sluiten.</p>
        ) : (
          <>
            <p className="mt-2 text-[14px] text-muted-foreground">De foto komt direct bij je behandelaar terecht en wordt alleen voor je behandeling gebruikt.</p>
            <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void send(f); }} />
            <div className="mt-6"><PillButton size="lg" className="w-full" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Versturen…" : "Camera openen"}</PillButton></div>
            {error && <p role="alert" className="mt-3 rounded-[12px] bg-warning-bg px-3 py-2 text-[13px] text-warning">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/** Scale the photo down so the upload stays small. */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
