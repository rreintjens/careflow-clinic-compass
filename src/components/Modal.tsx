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
}

/** Every add/edit in the admin happens in this modal, above the page. */
export function Modal({ open, onOpenChange, title, description, children, footer, width = "md" }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-foreground/30" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-[20px] bg-background shadow-[0_8px_24px_rgba(57,51,46,0.10)]",
            width === "md" ? "max-w-[560px]" : width === "lg" ? "max-w-[820px]" : "max-w-[1180px]",
          )}
        >
          <div className="flex items-start justify-between gap-4 px-7 pt-6">
            <div>
              <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
              {description && <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="Sluiten" className="rounded-full p-2 text-muted-foreground hover:bg-sand">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="overflow-y-auto px-7 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-7 py-4">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
