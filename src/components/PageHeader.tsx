import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid min-w-0 grid-cols-1 items-center gap-3 sm:flex sm:flex-wrap sm:justify-between sm:gap-4">
        <h1 className="min-w-0 break-words text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {actions && <div className="flex min-w-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {description && <p className="text-[15px] text-muted-foreground">{description}</p>}
    </div>
  );
}

/** Route exists in phase 1; the screen itself is built in the phase named. */
export function PhasePlaceholder({ title, phase }: { title: string; phase: number }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} />
      <div className="w-full rounded-[18px] bg-sand p-6 text-sm text-muted-foreground">Fase {phase}</div>
    </div>
  );
}
