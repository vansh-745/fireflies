import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("shimmer rounded-md bg-surface-sunken", className)} />;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      {icon && (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-accent-subtle text-accent-ink [&>svg]:size-6">
          {icon}
        </div>
      )}
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full bg-warning-subtle px-2 text-xxs font-semibold tracking-wide text-warning uppercase",
        className,
      )}
    >
      Coming soon
    </span>
  );
}

/** Full-page placeholder for features that are out of scope for this clone. */
export function ComingSoon({
  icon,
  title,
  description,
  bullets,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  bullets?: string[];
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
      <div className="relative mb-6 flex size-16 items-center justify-center rounded-2xl bg-accent-subtle text-accent-ink [&>svg]:size-8">
        {icon}
        <Sparkles className="absolute -top-2 -right-2 size-5 text-accent" aria-hidden />
      </div>
      <ComingSoonBadge />
      <h1 className="mt-3 font-display text-2xl font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-md text-ink-muted">{description}</p>
      {bullets && (
        <ul className="mt-6 grid w-full gap-2 text-left sm:grid-cols-2">
          {bullets.map((bullet) => (
            <li key={bullet} className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
              {bullet}
            </li>
          ))}
        </ul>
      )}
      {children}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-xl border border-border bg-surface shadow-elev-1", className)}>{children}</section>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-surface-raised px-1 font-sans text-xxs font-medium text-ink-subtle">
      {children}
    </kbd>
  );
}
