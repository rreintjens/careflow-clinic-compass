import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { type MailBlock, type MailSituation } from "@/domain/mail";
import { renderMailDocument, type MailTheme } from "@/domain/mail-document";
import { mailImageUrlQuery } from "@/data/mail-images";
import { photoUrl } from "@/data/organisation";
import openSans from "@fontsource/open-sans/files/open-sans-latin-400-normal.woff2?url";
import openSansBold from "@fontsource/open-sans/files/open-sans-latin-700-normal.woff2?url";

export function MailPreview({ blocks, language, values, situation, practitionerPhoto, categoryImage }: { blocks: MailBlock[]; language: string; values: Record<string, string>; situation: MailSituation; practitionerPhoto?: string | null | undefined; categoryImage?: string | null | undefined }) {
  const [theme, setTheme] = useState<MailTheme | null>(null);
  const [height, setHeight] = useState(900);
  const paths = [...new Set(blocks.map((block) => block.image_path).filter((path): path is string => !!path))];
  const urls = useQueries({ queries: paths.map(mailImageUrlQuery) });
  const { data: photo } = useQuery({ queryKey: ["photo", practitionerPhoto], queryFn: () => photoUrl(practitionerPhoto ?? null), enabled: !!practitionerPhoto, staleTime: 50 * 60 * 1000 });
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const token = (name: string) => css.getPropertyValue(name).trim();
    setTheme({ background: token("--background"), surface: token("--mail-surface"), heading: token("--mail-heading"), text: token("--mail-text"), muted: token("--muted-foreground"), panel: token("--mail-panel"), button: token("--mail-button"), onPanel: token("--primary-foreground"), link: token("--mail-link") });
  }, []);
  if (!theme) return null;
  const images = Object.fromEntries(paths.flatMap((path, index) => { const url = urls[index]?.data; return url ? [[path, url]] : []; }));
  const html = renderMailDocument({ blocks, language, values, situation, images, practitionerPhoto: photo ?? null, categoryImage: categoryImage ?? null, theme });
  const fonts = `<style>@font-face{font-family:'Open Sans';font-style:normal;font-weight:400;font-display:swap;src:url('${openSans}') format('woff2')}@font-face{font-family:'Open Sans';font-style:normal;font-weight:700;font-display:swap;src:url('${openSansBold}') format('woff2')}</style>`;
  return <iframe title="Voorbeeld van de e-mail" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" className="mx-auto block w-full max-w-[600px] border-0 bg-background" height={height} srcDoc={html.replace("</head>", `${fonts}</head>`)} onLoad={(event) => {
    const frame = event.currentTarget;
    const body = frame.contentDocument?.body;
    if (!body) return;
    const resize = () => setHeight(Math.max(300, body.scrollHeight));
    resize();
    frame.contentDocument?.fonts.ready.then(resize);
    for (const image of Array.from(body.querySelectorAll("img"))) image.addEventListener("load", resize, { once: true });
  }} />;
}