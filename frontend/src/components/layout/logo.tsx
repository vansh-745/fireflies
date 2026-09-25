import { useId } from "react";

import { cn } from "@/lib/cn";

/** Original mark for this clone (a glowing firefly in the brand gradient). */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8", className)}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff4f9a" />
          <stop offset="55%" stopColor="#9b5cff" />
          <stop offset="100%" stopColor="#4a7dff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id})`} />
      <ellipse cx="11.5" cy="12.5" rx="5.5" ry="3.2" fill="#fff" opacity="0.55" transform="rotate(-25 11.5 12.5)" />
      <ellipse cx="20.5" cy="12.5" rx="5.5" ry="3.2" fill="#fff" opacity="0.55" transform="rotate(25 20.5 12.5)" />
      <circle cx="16" cy="19" r="5" fill="#fff" />
      <circle cx="16" cy="19" r="2.2" fill="#ffd54a" />
    </svg>
  );
}

export function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!collapsed && (
        <span className="flex items-baseline gap-1.5">
          <span className="font-display text-lg font-bold tracking-tight text-ink">fireflies</span>
          <span className="rounded bg-accent-subtle px-1 text-[10px] font-semibold text-accent-ink uppercase">clone</span>
        </span>
      )}
    </span>
  );
}
