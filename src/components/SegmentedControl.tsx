import { cn } from "@/lib/utils";

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** "chips": separate pills, the chosen one filled (e.g. Vorm in the Boodschap window). */
  variant?: "track" | "chips";
}

/** Pill segmented control (e.g. Dag / Week / Mijn dag). Labels never wrap. */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className, variant = "track" }: SegmentedControlProps<T>) {
  const chips = variant === "chips";
  return (
    <div role="radiogroup" aria-label={label} className={cn(chips ? "flex flex-wrap gap-2" : "inline-flex gap-1 overflow-x-auto rounded-full bg-sand p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-9 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
              chips ? (active ? "bg-primary text-primary-foreground" : "bg-sand text-foreground hover:text-primary")
                : active ? "bg-background text-primary shadow-sm" : "text-foreground hover:text-primary",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
