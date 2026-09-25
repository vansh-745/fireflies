"use client";

import { X } from "lucide-react";
import { Dialog as RadixDialog } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, cancel first. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const WIDTHS = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

/** Centre-origin dialog: scale(0.96) + fade over --duration-overlay; Escape and scrim click close it. */
export function Dialog({ open, onOpenChange, title, description, children, footer, size = "md", className }: DialogProps) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="dialog-scrim fixed inset-0 z-50 bg-scrim" />
        <RadixDialog.Content
          className={cn(
            "dialog-content fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col",
            "rounded-xl border border-border bg-surface-overlay shadow-elev-3 focus:outline-none",
            WIDTHS[size],
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 pt-5 pb-4">
            <div className="min-w-0">
              <RadixDialog.Title className="font-display text-lg font-semibold text-ink">{title}</RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="mt-1 text-sm text-ink-muted">{description}</RadixDialog.Description>
              ) : (
                <RadixDialog.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              aria-label="Close"
              className="pressable -mr-2 inline-flex size-8 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <X className="size-4" />
            </RadixDialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  destructive = true,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <RadixDialog.Close asChild>
            <button
              type="button"
              className="pressable h-9 rounded-md border border-border bg-surface px-4 text-sm font-medium text-ink hover:bg-surface-raised"
            >
              Cancel
            </button>
          </RadixDialog.Close>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "pressable h-9 rounded-md px-4 text-sm font-medium disabled:opacity-60",
              destructive ? "bg-danger text-on-danger hover:opacity-90" : "bg-accent text-on-accent hover:bg-accent-hover",
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
