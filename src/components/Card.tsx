import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface CardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  tone?: "white" | "sand";
  /** Small content at the right of the title, e.g. a mode hint. */
  action?: ReactNode;
}

/** Full-width card, radius 18px. */
export function Card({ title, description, tone = "white", action, className, children, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "min-w-0 w-full rounded-[18px] p-4 sm:p-6",
        tone === "white" ? "border border-line bg-card" : "bg-sand",
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <header className="mb-5">
          {title && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><h2 className="min-w-0 break-words text-base font-semibold">{title}</h2>{action}</div>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
