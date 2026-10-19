import { cn } from "@/lib/utils";

/** A package icon from /ui-icons, painted in the current text colour so size and colour follow the context. */
export function UiIcon({ name, className }: { name: string; className?: string }) {
  const url = `url(/ui-icons/${name}.svg)`;
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{
        WebkitMaskImage: url, maskImage: url, WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center",
      }}
    />
  );
}
