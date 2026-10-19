import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Live (green dot), concept (orange dot) and archive pills of the version flow. */
export function VersionPill({ tone, children }: { tone: "live" | "draft" | "archive"; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px]", tone === "live" ? "bg-teal-light text-primary-hover" : tone === "draft" ? "bg-warning-bg text-warning" : "bg-sand text-muted-foreground")}>
      {tone !== "archive" && <span className={cn("size-1.5 rounded-full", tone === "live" ? "bg-primary" : "bg-warning")} aria-hidden="true" />}
      {children}
    </span>
  );
}
