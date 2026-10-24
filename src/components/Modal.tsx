import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg" | "xl";
  initialFocusId?: string;
}

/** Every add/edit in the admin happens in this modal, above the page. */
export function Modal({ open, onOpenChange, title, description, children, footer, width = "md", initialFocusId }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
        <Dialog.Content
          onOpenAutoFocus={(event) => {
            const field = initialFocusId ? document.getElementById(initialFocusId) : null;
            if (field) { event.preventDefault(); field.focus(); }
          }}
          className={cn(
            "app-modal fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] bg-background shadow-[0_8px_24px_rgba(57,51,46,0.10)] sm:max-h-[90dvh] sm:w-[calc(100%-32px)]",
            width === "md" ? "max-w-[560px]" : width === "lg" ? "max-w-[820px]" : "max-w-[1180px]",
          )}
        >
          <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 pt-4 sm:px-7 sm:pt-6">
            <div className="min-w-0 break-words">
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Sluiten" className="rounded-full p-2 text-muted-foreground hover:bg-sand">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 min-w-0 overflow-y-auto px-4 py-4 sm:px-7 sm:py-5">{children}</div>
          {footer && <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-line px-4 py-3 sm:px-7 sm:py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
