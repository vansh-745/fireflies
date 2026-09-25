import { colorSlot, speakerStyle } from "@/lib/colors";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const SIZES = {
  xs: "size-5 text-[9px]",
  sm: "size-7 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-10 text-sm",
};

export function Avatar({
  name,
  slot,
  size = "md",
  className,
  ring = false,
}: {
  name: string;
  /** Colour slot 1–8; defaults to a stable hash of the name. */
  slot?: number;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  return (
    <span
      title={name}
      style={speakerStyle(slot ?? colorSlot(name))}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-(--chip-bg) font-semibold text-(--chip-ink) select-none",
        ring && "ring-2 ring-surface",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 4,
  size = "sm",
}: {
  names: string[];
  max?: number;
  size?: keyof typeof SIZES;
}) {
  const shown = names.slice(0, max);
  const rest = names.length - shown.length;
  return (
    <span className="flex items-center -space-x-1" aria-label={names.join(", ")}>
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} ring />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted ring-2 ring-surface",
            SIZES[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
