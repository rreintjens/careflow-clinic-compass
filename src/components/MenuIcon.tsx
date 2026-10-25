import { svgIconError } from "@/domain/svg-icon";
import { createContext, useContext, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Menu icon keys: "ui:<name>" (package UI icons), "tabler:<name>" (Tabler outline), "custom:<id>" (tenant upload)
 * and a plain name for the clinic's own colour treatment icons in /treatment-icons.
 */
const CustomIcons = createContext<ReadonlyArray<{ id: string; svg: string }>>([]);
export function CustomIconsProvider({ icons, children }: { icons: ReadonlyArray<{ id: string; svg: string }>; children: ReactNode }) {
  return <CustomIcons.Provider value={icons}>{children}</CustomIcons.Provider>;
}

export function iconUrl(key: string, custom: ReadonlyArray<{ id: string; svg: string }>): { url: string; mask: boolean } | null {
  if (key.startsWith("ui:")) return { url: `/ui-icons/${key.slice(3)}.svg`, mask: true };
  if (key.startsWith("tabler:")) return { url: `/tabler/${key.slice(7)}.svg`, mask: true };
  if (key.startsWith("custom:")) {
    const svg = custom.find((c) => c.id === key.slice(7))?.svg;
    return svg && !svgIconError(svg) ? { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, mask: true } : null;
  }
  return key ? { url: `/treatment-icons/${key}.png`, mask: false } : null;
}

export function MenuIcon({ icon, inherited, className }: { icon: string | null | undefined; inherited?: boolean; className?: string }) {
  const custom = useContext(CustomIcons);
  const u = icon ? iconUrl(icon, custom) : null;
  const cls = cn("inline-block size-7 shrink-0", inherited && "opacity-40", className);
  if (!u) return <span aria-hidden="true" className={cls} />;
  if (!u.mask) return <img src={u.url} alt="" className={cn(cls, "object-contain")} />;
  const url = `url("${u.url}")`;
  return (
    <span aria-hidden="true" className={cn(cls, "bg-primary")} style={{
      WebkitMaskImage: url, maskImage: url, WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center",
    }} />
  );
}
