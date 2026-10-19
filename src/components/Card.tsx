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
        "w-full rounded-[18px] p-6",
        tone === "white" ? "border border-line bg-card" : "bg-sand",
        className,
      )}
      {...props}
    >
      {(title || description) && (
        <header className="mb-5">
          {title && <div className="flex items-start justify-between gap-4"><h2 className="text-base font-semibold">{title}</h2>{action}</div>}
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
