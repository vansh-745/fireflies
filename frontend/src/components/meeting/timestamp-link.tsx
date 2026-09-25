"use client";

import { Play } from "lucide-react";

import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";

import { useMeetingUI } from "./meeting-context";

/** A clickable time that seeks the player and scrolls the transcript there. */
export function TimestampLink({ ms, className, withIcon = false }: { ms: number; className?: string; withIcon?: boolean }) {
  const { jumpTo } = useMeetingUI();
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        jumpTo(ms, { play: true });
      }}
      aria-label={`Play from ${formatTimestamp(ms)}`}
      className={cn(
        "pressable inline-flex items-center gap-1 rounded px-1 align-baseline font-mono text-[12px] font-medium text-accent-ink tabular-nums",
        "hover:bg-accent-subtle",
        className,
      )}
    >
      {withIcon && <Play className="size-3 fill-current" aria-hidden />}
      {formatTimestamp(ms)}
    </button>
  );
}
