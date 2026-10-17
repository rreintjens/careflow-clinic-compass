import * as Popover from "@radix-ui/react-popover";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

import type { SelectOption } from "./Select";

export interface MultiSelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  help?: string | null;
  className?: string;
}

/** Select with several choices; chosen items show as removable chips in the sand field. */
export function MultiSelect({ label, options, value, onChange, help, className }: MultiSelectProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const chosen = options.filter((o) => value.includes(o.value));
  const rest = options.filter((o) => !value.includes(o.value));
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <span id={id} className="text-[13px] font-medium">{label}</span>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div aria-labelledby={id} className="flex min-h-12 items-center gap-2 rounded-[14px] bg-sand py-1.5 pl-2 pr-1.5">
          <div className="flex flex-1 flex-wrap gap-1.5">
            {chosen.map((o) => (
              <span key={o.value} className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-background px-3 text-sm">
                {o.label}
                <button type="button" aria-label={`${o.label} verwijderen`} onClick={() => onChange(value.filter((v) => v !== o.value))} className="text-muted-foreground hover:text-foreground">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                </button>
              </span>
            ))}
          </div>
          <Popover.Trigger aria-label={`${label} toevoegen`} disabled={rest.length === 0} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-primary disabled:opacity-40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </Popover.Trigger>
        </div>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} className="z-50 max-h-80 min-w-[240px] overflow-y-auto rounded-[14px] border border-mist bg-popover p-1.5 shadow-[0_8px_24px_rgba(57,51,46,0.10)]">
            {rest.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange([...value, o.value]); setOpen(false); }}
                className="block w-full rounded-[10px] px-3 py-2.5 text-left text-sm hover:bg-teal-light"
              >
                {o.label}
              </button>
            ))}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
    </div>
  );
}
