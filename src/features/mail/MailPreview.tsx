import { Logo } from "@/components/Logo";
import { blockVisible, interpolate, safeMailUrl, translated, type MailBlock, type MailSituation } from "@/domain/mail";
import { Avatar } from "@/components/Avatar";
import { MailImage } from "./MailImage";

export function MailPreview({ blocks, language, values, situation, practitionerPhoto }: { blocks: MailBlock[]; language: string; values: Record<string, string>; situation: MailSituation; practitionerPhoto?: string | null | undefined }) {
  const text = (nl: string, en: string) => interpolate(translated(nl, en, language), values);
  return <div className="mx-auto flex max-w-[600px] flex-col gap-4 bg-background p-4 text-[13px] leading-[1.8]">
    <div className="flex justify-center py-2"><Logo /></div>
    {blocks.filter((b) => blockVisible(b.condition, situation)).map((b) => {
      if (b.type === "divider") return <hr key={b.id} className="border-line" />;
      if (b.type === "image") return b.image_path ? <MailImage key={b.id} path={b.image_path} alt={text(b.title_nl, b.title_en)} className="aspect-[5/2] w-full rounded-t-[20px] object-cover" /> : b.image && safeMailUrl(b.image)?.startsWith("https:") ? <img key={b.id} src={b.image} alt={text(b.title_nl, b.title_en)} className="aspect-[5/2] w-full rounded-t-[20px] object-cover" /> : null;
      const url = safeMailUrl(interpolate(b.url, values));
      if (b.type === "signature") return <div key={b.id} className="rounded-[20px] bg-sand p-5"><div className="mb-3 flex items-center gap-4">{b.image_path ? <MailImage path={b.image_path} className="h-[92px] w-[92px] shrink-0 rounded-full object-cover" /> : practitionerPhoto ? <Avatar path={practitionerPhoto} size={92} /> : null}<div className="whitespace-pre-line">{text(b.text_nl, b.text_en)}</div></div><h3 className="font-semibold text-primary-hover">{text(b.title_nl, b.title_en)}</h3></div>;
      return <div key={b.id} className={b.type === "card" || b.type === "details" ? "rounded-[20px] bg-sand p-5" : ""}>
        {b.title_nl && <h3 className="mb-2 text-[17px] font-semibold text-primary-hover">{text(b.title_nl, b.title_en)}</h3>}
        {b.type === "details" ? <div className="whitespace-pre-line">{[values['behandeling'], `${values['dag'] ?? ""} ${values['tijd'] ?? ""}`, values['behandelaar'], situation.online ? values['meet_link'] : values['adres']].filter(Boolean).join("\n")}</div> : <div className="whitespace-pre-line break-words">{text(b.text_nl, b.text_en)}</div>}
        {b.button_nl && (url ? <a href={url} target="_blank" rel="noreferrer" className="mt-3 block rounded-full bg-primary px-5 py-3 text-center font-medium text-primary-foreground">{text(b.button_nl, b.button_en)}</a> : <span className="mt-3 block rounded-full bg-primary px-5 py-3 text-center font-medium text-primary-foreground">{text(b.button_nl, b.button_en)}</span>)}
      </div>;
    })}
  </div>;
}