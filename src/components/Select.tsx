import * as RSelect from "@radix-ui/react-select";
import { useId } from "react";

import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  label: string;
  options: readonly SelectOption[];
  value: string;
  onChange: (value: string) => void;
  help?: string | null;
  disabled?: boolean;
  className?: string;
}

/** The only select in the app: sand field, no border, teal chevron. */
export function Select({ label, options, value, onChange, help, disabled, className }: SelectProps) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </label>
      <RSelect.Root value={value} onValueChange={onChange} disabled={disabled ?? false}>
        <RSelect.Trigger
          id={id}
          className="flex h-12 items-center justify-between gap-2.5 rounded-[14px] bg-sand px-4 text-left text-[15px] data-[disabled]:opacity-60"
        >
          <span className="truncate">
            <RSelect.Value />
          </span>
          <RSelect.Icon>
            <Chevron />
          </RSelect.Icon>
        </RSelect.Trigger>
        <RSelect.Portal>
          <RSelect.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[14px] border border-mist bg-popover p-1.5 shadow-[0_8px_24px_rgba(57,51,46,0.10)]"
          >
            <RSelect.Viewport>
              {options.map((o) => (
                <RSelect.Item
                  key={o.value}
                  value={o.value}
                  className="cursor-pointer rounded-[10px] px-3 py-2.5 text-sm outline-none data-[highlighted]:bg-teal-light data-[state=checked]:font-medium data-[state=checked]:text-primary"
                >
                  <RSelect.ItemText>{o.label}</RSelect.ItemText>
                </RSelect.Item>
              ))}
            </RSelect.Viewport>
          </RSelect.Content>
        </RSelect.Portal>
      </RSelect.Root>
      {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-primary">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
