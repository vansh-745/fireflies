import { X } from "lucide-react";
import type { ReactNode } from "react";

import { speakerStyle, tagSlot } from "@/lib/colors";
import { cn } from "@/lib/cn";

/** Coloured tag chip (tags reuse the speaker palette). */
export function TagChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span
      style={speakerStyle(tagSlot(color))}
      className={cn(
        "inline-flex h-5 items-center rounded-full bg-(--chip-bg) px-2 text-xxs font-medium whitespace-nowrap text-(--chip-ink)",
        className,
      )}
    >
      {name}
    </span>
  );
}

/** Neutral pill used for keywords, filters and counts. */
export function Chip({
  children,
  onClick,
  onRemove,
  active,
  icon,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  active?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      {icon}
      <span className="truncate">{children}</span>
      {onRemove && (
        <span
          role="button"
          tabIndex={0}
          aria-label="Remove"
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onRemove();
            }
          }}
          className="-mr-1 inline-flex size-4 items-center justify-center rounded-full hover:bg-surface-sunken"
        >
          <X className="size-3" />
        </span>
      )}
    </>
  );
  const classes = cn(
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium",
    active ? "border-accent bg-accent-subtle text-accent-ink" : "border-border bg-surface text-ink-muted",
    onClick && "pressable cursor-pointer hover:border-border-strong hover:text-ink",
    className,
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={classes} aria-pressed={active}>
      {body}
    </button>
  ) : (
    <span className={classes}>{body}</span>
  );
}

export function CountBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-semibold",
        tone === "accent" ? "bg-accent text-on-accent" : "bg-surface-sunken text-ink-muted",
      )}
    >
      {children}
    </span>
  );
}
