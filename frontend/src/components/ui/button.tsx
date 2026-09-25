"use client";

import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Tooltip } from "./tooltip";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "soft";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-elev-1",
  secondary: "bg-surface text-ink border border-border hover:bg-surface-raised hover:border-border-strong",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger text-on-danger hover:opacity-90",
  soft: "bg-accent-subtle text-accent-ink hover:bg-accent hover:text-on-accent",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 gap-1.5 text-[13px]",
  md: "h-9 px-4 gap-2 text-sm",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

/** Press feedback is scale(0.97) (see .pressable). Loading blurs the label instead of swapping it. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "pressable relative inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        loading && "is-loading",
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle aria-hidden className="spin absolute size-4" />}
      <span className="btn-label inline-flex items-center gap-[inherit]">
        {icon}
        {children}
      </span>
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  active?: boolean;
  tooltip?: boolean;
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

/** Square ghost button; the label becomes the tooltip and the accessible name. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", active = false, tooltip = true, tooltipSide = "bottom", className, children, type = "button", ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={active || undefined}
      className={cn(
        "pressable inline-flex shrink-0 items-center justify-center rounded-md text-ink-muted",
        "hover:bg-surface-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "size-7" : "size-9",
        active && "bg-accent-subtle text-accent-ink hover:bg-accent-subtle hover:text-accent-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
  return tooltip ? (
    <Tooltip content={label} side={tooltipSide}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
