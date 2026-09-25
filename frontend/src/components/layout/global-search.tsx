"use client";

import { CornerDownLeft, FileText, Search, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Kbd } from "@/components/ui/feedback";
import { useDebounced } from "@/lib/hooks";
import { useSearch } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { formatMeetingDate, formatTimestamp } from "@/lib/format";

/** Top-bar search: live results across titles and transcripts; Enter opens the full results page. */
export function GlobalSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const query = useDebounced(value, 200);
  const { data, isFetching } = useSearch(query);

  // ⌘K / Ctrl+K focuses search from anywhere (keyboard action: no animation).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = (query.trim() && data?.results.slice(0, 5)) || [];
  const options = results.map((r) => ({
    key: r.meeting_id,
    href: r.hits[0]
      ? `/meetings/${r.meeting_id}?t=${r.hits[0].start_ms}&q=${encodeURIComponent(query.trim())}`
      : `/meetings/${r.meeting_id}`,
    result: r,
  }));

  const go = (href: string) => {
    setOpen(false);
    inputRef.current?.blur();
    router.push(href);
  };

  const submit = () => {
    const option = options[highlight];
    if (option && highlight >= 0 && open && highlight < options.length) go(option.href);
    else if (value.trim()) go(`/search?q=${encodeURIComponent(value.trim())}`);
  };

  return (
    <div className="relative w-full max-w-xl">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((h) => Math.min(h + 1, options.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => Math.max(h - 1, -1));
            } else if (event.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search meetings, transcripts and topics"
          aria-label="Search all meetings"
          aria-expanded={open && options.length > 0}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          role="combobox"
          className="h-9 w-full rounded-lg border border-transparent bg-surface-sunken pr-14 pl-9 text-sm text-ink placeholder:text-ink-subtle hover:border-border focus:border-accent focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent-subtle"
        />
        <span className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 items-center gap-0.5 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </form>

      {open && query.trim() && (
        <div
          id="global-search-results"
          role="listbox"
          className="menu-content absolute top-full right-0 left-0 z-40 mt-2 overflow-hidden rounded-xl border border-border bg-surface-overlay shadow-elev-3"
          data-state="open"
        >
          {options.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-ink-muted">
              {isFetching ? "Searching…" : `No matches for “${query.trim()}”`}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto p-1">
              {options.map((option, index) => (
                <li key={option.key} role="option" aria-selected={index === highlight}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => go(option.href)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left",
                      index === highlight && "bg-surface-sunken",
                    )}
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-ink">
                      {option.result.hits.length ? <FileText className="size-4" /> : <Video className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-ink">{option.result.title}</span>
                        <span className="shrink-0 text-xxs text-ink-subtle">{formatMeetingDate(option.result.started_at)}</span>
                      </span>
                      {option.result.hits[0] && (
                        <span className="mt-0.5 line-clamp-2 text-xs text-ink-muted">
                          <span className="font-medium text-accent-ink">{formatTimestamp(option.result.hits[0].start_ms)} </span>
                          <span dangerouslySetInnerHTML={{ __html: option.result.hits[0].snippet }} />
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => go(`/search?q=${encodeURIComponent(query.trim())}`)}
            className="flex w-full items-center justify-between border-t border-border px-4 py-2.5 text-[13px] text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <span>
              See all results for <span className="font-medium text-ink">“{query.trim()}”</span>
            </span>
            <CornerDownLeft className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </div>
  );
}
