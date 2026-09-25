"use client";

import { X } from "lucide-react";
import { useState, type KeyboardEvent } from "react";

import { cn } from "@/lib/cn";

/** Type a value and press Enter or comma to add it as a chip. */
export function ChipInput({
  id,
  values,
  onChange,
  placeholder,
  suggestions = [],
  renderChip,
  lockedValues = [],
}: {
  id?: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  renderChip?: (value: string) => React.ReactNode;
  /** Values that can't be removed (e.g. transcript speakers). */
  lockedValues?: string[];
}) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const add = (raw: string) => {
    const value = raw.trim().replace(/,$/, "").trim();
    if (!value || values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...values, value]);
    setDraft("");
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      const last = values[values.length - 1];
      if (!lockedValues.includes(last)) onChange(values.slice(0, -1));
    }
  };

  const matches = draft
    ? suggestions
        .filter((s) => s.toLowerCase().includes(draft.toLowerCase()) && !values.some((v) => v.toLowerCase() === s.toLowerCase()))
        .slice(0, 5)
    : [];

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-surface px-2 py-1.5",
          focused ? "border-accent ring-2 ring-accent-subtle" : "border-border hover:border-border-strong",
        )}
      >
        {values.map((value) => {
          const locked = lockedValues.includes(value);
          return (
            <span key={value} className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-sunken pr-1 pl-2 text-xs font-medium text-ink">
              {renderChip ? renderChip(value) : value}
              {!locked && (
                <button
                  type="button"
                  aria-label={`Remove ${value}`}
                  onClick={() => onChange(values.filter((v) => v !== value))}
                  className="inline-flex size-4 items-center justify-center rounded-full text-ink-muted hover:bg-border hover:text-ink"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            if (draft.trim()) add(draft);
          }}
          placeholder={values.length ? "" : placeholder}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-sm text-ink placeholder:text-ink-subtle focus:outline-none"
        />
      </div>
      {focused && matches.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-surface-overlay py-1 shadow-elev-2">
          {matches.map((match) => (
            <li key={match}>
              <button
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  add(match);
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-sunken"
              >
                {match}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
