import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/utils";
import { PillButton } from "./PillButton";
import { UiIcon } from "./UiIcon";

/** Readable dossier content is also the keyboard-accessible edit action. */
export function EditableFieldRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return <PillButton variant="ghost" aria-label={label} aria-haspopup="dialog" onClick={onClick} className="h-auto min-h-16 w-full justify-between whitespace-normal rounded-none border-b border-mist px-3 py-4 text-left font-normal text-foreground hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <span className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[220px_1fr] sm:gap-4"><span className="text-[13px] font-medium">{label}</span><span className="min-w-0 whitespace-pre-wrap break-words text-[14px]">{value || "–"}</span></span>
    <UiIcon name="pijl-rechts" className="h-4 w-4 shrink-0 text-primary" />
  </PillButton>;
}

export const inputCls = "h-12 w-full rounded-[14px] bg-sand px-4 text-[15px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function TextField({ label, help, className, ...props }: { label: string; help?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <input id={id} className={inputCls} {...props} />
      {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
    </div>
  );
}

export function TextArea({ label, help, className, id: providedId, ...props }: { label: string; help?: ReactNode } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className="text-[13px] font-medium">{label}</label>
      <textarea id={id} rows={3} className="w-full resize-y rounded-[14px] bg-sand px-4 py-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-ring" {...props} />
      {help && <span className="text-xs leading-[1.45] text-muted-foreground">{help}</span>}
    </div>
  );
}

export function SearchField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
        <circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" />
      </svg>
      <input type="search" className={cn(inputCls, "rounded-full pl-11")} {...props} />
    </div>
  );
}

/** Toggle pill (e.g. a location chip). Selected = teal with check. */
export function Chip({ selected, onClick, children, disabled }: { selected: boolean; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm transition-colors disabled:opacity-50",
        selected ? "bg-primary text-primary-foreground hover:bg-primary-hover" : "bg-sand text-foreground hover:bg-mist",
      )}
    >
      {selected && <CheckIcon />}
      {children}
    </button>
  );
}

export function Tag({ children, tone = "teal" }: { children: ReactNode; tone?: "teal" | "sand" | "warning" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center whitespace-nowrap rounded-full px-2.5 text-xs",
        tone === "teal" && "bg-teal-light text-primary-hover",
        tone === "sand" && "bg-sand text-foreground",
        tone === "warning" && "bg-warning-bg text-warning",
      )}
    >
      {children}
    </span>
  );
}

/** Round status mark: check (ok), exclamation (warning) or dash (neutral). */
export function StatusMark({ kind }: { kind: "ok" | "warn" | "none" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
        kind === "ok" && "bg-teal-light text-primary",
        kind === "warn" && "bg-warning-bg text-warning",
        kind === "none" && "bg-sand text-muted-foreground",
      )}
    >
      {kind === "ok" && <CheckIcon size={13} />}
      {kind === "warn" && <span className="text-[11px] font-semibold leading-none">!</span>}
      {kind === "none" && <span className="text-xs leading-none">–</span>}
    </span>
  );
}

export function CheckIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Checkbox({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 text-left text-[14px] transition-colors disabled:opacity-50"
    >
      <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-md border", checked ? "border-primary bg-primary text-primary-foreground" : "border-mist bg-background")}>
        {checked && <CheckIcon size={12} />}
      </span>
      {label}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-mist")}
    >
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-background transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

export function TextLink({ children, onClick, tone = "teal" }: { children: ReactNode; onClick?: () => void; tone?: "teal" | "warning" }) {
  return (
    <button type="button" onClick={onClick} className={cn("whitespace-nowrap text-sm underline underline-offset-2", tone === "teal" ? "text-primary hover:text-primary-hover" : "text-warning")}>
      {children}
    </button>
  );
}

/** Table header cell / row helpers for admin lists. */
export const thCls = "whitespace-nowrap px-2.5 pb-3 text-left text-xs font-normal text-muted-foreground";
export const tdCls = "px-2.5 py-3.5 align-middle text-sm";
