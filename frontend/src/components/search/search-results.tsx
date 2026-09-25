"use client";

import { Clock, Search, SearchX } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Card, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Input } from "@/components/ui/field";
import { formatDuration, formatMeetingDate, formatTimestamp } from "@/lib/format";
import { useSearch } from "@/lib/queries";

/** Full results for the global search: every meeting whose title or transcript matches. */
export function SearchResults() {
  const q = useSearchParams().get("q") ?? "";
  // Keyed by query so the input resets when a new search arrives from the top bar.
  return <Results key={q} q={q} />;
}

function Results({ q }: { q: string }) {
  const router = useRouter();
  const [draft, setDraft] = useState(q);
  const { data, isLoading, isFetching } = useSearch(q);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Search</h1>
      <p className="mt-1 text-sm text-ink-muted">Full-text search across every title and transcript, with word stemming.</p>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (draft.trim()) router.replace(`/search?q=${encodeURIComponent(draft.trim())}`);
        }}
      >
        <Input icon={<Search />} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Search all meetings" aria-label="Search all meetings" className="h-11 text-md" autoFocus />
      </form>

      {!q.trim() ? (
        <EmptyState className="mt-8" icon={<Search />} title="Search your meetings" description="Try “pricing”, “Salesforce” or a person's name." />
      ) : isLoading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}</div>
      ) : !data?.results.length ? (
        <EmptyState className="mt-8" icon={<SearchX />} title={`No results for “${q}”`} description="Check the spelling or try a broader term." />
      ) : (
        <>
          <p className="mt-6 text-sm text-ink-muted" aria-live="polite">
            {data.total_meetings} meeting{data.total_meetings === 1 ? "" : "s"} match <span className="font-medium text-ink">“{data.query}”</span>
            {isFetching && " · updating…"}
          </p>
          <ul className="mt-3 flex flex-col gap-3">
            {data.results.map((result) => (
              <li key={result.meeting_id}>
                <Card className="overflow-hidden">
                  <Link href={`/meetings/${result.meeting_id}?q=${encodeURIComponent(q)}`} className="block px-5 pt-4 pb-3 hover:bg-surface-raised">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="truncate font-medium text-ink">{result.title}</h2>
                      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xxs font-medium text-ink-muted">
                        {result.total_hits ? `${result.total_hits} mention${result.total_hits === 1 ? "" : "s"}` : "Title match"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-subtle">
                      <span>{formatMeetingDate(result.started_at)}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDuration(result.duration_seconds)}
                      </span>
                    </div>
                  </Link>
                  {result.hits.length > 0 && (
                    <ul className="border-t border-border">
                      {result.hits.map((hit) => (
                        <li key={hit.segment_id}>
                          <Link
                            href={`/meetings/${result.meeting_id}?t=${hit.start_ms}&q=${encodeURIComponent(q)}`}
                            className="flex gap-3 px-5 py-2.5 text-sm hover:bg-surface-raised"
                          >
                            <span className="shrink-0 pt-0.5 font-mono text-xs font-medium text-accent-ink tabular-nums">{formatTimestamp(hit.start_ms)}</span>
                            <span className="min-w-0 text-ink-muted">
                              {hit.speaker && <span className="font-medium text-ink">{hit.speaker}: </span>}
                              {/* Snippet is HTML-escaped by the API; only <mark> tags are added. */}
                              <span dangerouslySetInnerHTML={{ __html: hit.snippet }} />
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
