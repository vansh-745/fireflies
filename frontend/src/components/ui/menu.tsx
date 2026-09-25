"use client";

import { Check } from "lucide-react";
import { DropdownMenu, Popover as RadixPopover } from "radix-ui";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

const SURFACE = "menu-content z-50 min-w-[200px] rounded-lg border border-border bg-surface-overlay p-1 shadow-elev-2";

/** Dropdown menu that scales out of its trigger (origin from Radix). */
export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  className?: string;
}) {
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} side={side} sideOffset={6} className={cn(SURFACE, className)}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function MenuItem({
  children,
  icon,
  onSelect,
  destructive,
  disabled,
  hint,
}: {
  children: ReactNode;
  icon?: ReactNode;
  onSelect?: (event: Event) => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      disabled={disabled}
      className={cn(
        "flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm outline-none select-none",
        "data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        destructive
          ? "text-danger data-[highlighted]:bg-danger-subtle"
          : "text-ink data-[highlighted]:bg-surface-sunken",
      )}
    >
      {icon && <span className="flex size-4 items-center justify-center text-current opacity-80 [&>svg]:size-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      {hint && <span className="text-xs text-ink-subtle">{hint}</span>}
    </DropdownMenu.Item>
  );
}

export function MenuCheckItem({
  children,
  checked,
  onCheckedChange,
}: {
  children: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={checked}
      onCheckedChange={onCheckedChange}
      onSelect={(event) => event.preventDefault()}
      className="flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-ink outline-none select-none data-[highlighted]:bg-surface-sunken"
    >
      <span className="flex size-4 items-center justify-center">
        <DropdownMenu.ItemIndicator>
          <Check className="size-4 text-accent" />
        </DropdownMenu.ItemIndicator>
      </span>
      {children}
    </DropdownMenu.CheckboxItem>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2 pt-2 pb-1 text-xxs font-semibold tracking-wide text-ink-subtle uppercase">{children}</DropdownMenu.Label>;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

/** Anchored popover for richer content (filters, notifications). */
export function Popover({
  trigger,
  children,
  align = "start",
  open,
  onOpenChange,
  className,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}) {
  return (
    <RadixPopover.Root open={open} onOpenChange={onOpenChange}>
      <RadixPopover.Trigger asChild>{trigger}</RadixPopover.Trigger>
      <RadixPopover.Portal>
        <RadixPopover.Content align={align} sideOffset={6} className={cn(SURFACE, "p-0", className)}>
          {children}
        </RadixPopover.Content>
      </RadixPopover.Portal>
    </RadixPopover.Root>
  );
}
