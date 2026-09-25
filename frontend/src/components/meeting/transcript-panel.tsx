"use client";

import { ChevronDown, ChevronUp, Copy, Crosshair, Filter, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { activeIndexAt, usePlayer, usePlayerStore } from "@/lib/player";
import { useComments } from "@/lib/queries";
import type { Comment, Segment, SegmentFlag } from "@/lib/types";

import { NewActionItemDialog } from "./action-items";
import { matchesFilter, slotFor, useMeetingUI } from "./meeting-context";
import { TranscriptSegment } from "./transcript-segment";

export const FLAG_FILTERS: { flag: SegmentFlag; label: string }[] = [
  { flag: "question", label: "Questions" },
  { flag: "task", label: "Tasks" },
  { flag: "metric", label: "Metrics" },
  { flag: "date", label: "Dates & times" },
];

function countOccurrences(text: string, query: string): number {
  if (!query) return 0;
  let count = 0;
  const lower = text.toLowerCase();
  for (let at = lower.indexOf(query); at !== -1; at = lower.indexOf(query, at + query.length)) count += 1;
  return count;
}

const EMPTY: Comment[] = [];

export function TranscriptPanel() {
  const ui = useMeetingUI();
  const { meeting, segments, search, setSearch, filter, setFilter, autoScroll, setAutoScroll, jumpToken, jumpTarget, openPanel } = ui;
  const store = usePlayerStore();
  const [taskSegment, setTaskSegment] = useState<Segment | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const refs = useRef(new Map<number, HTMLElement>());
  const { data: comments = [] } = useComments(meeting.id);

  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  const activeIndex = usePlayer((s) => activeIndexAt(starts, s.currentMs));
  const playing = usePlayer((s) => s.playing);
  const activeId = segments[activeIndex]?.id;

  const query = search.trim().toLowerCase();

  const visible = useMemo(() => segments.filter((s) => matchesFilter(filter, s)), [segments, filter]);

  // Every match as (segment, nth occurrence inside it), in reading order.
  const matches = useMemo(() => {
    if (!query) return [];
    return visible.flatMap((s) => Array.from({ length: countOccurrences(s.text, query) }, (_, n) => ({ segmentId: s.id, occurrence: n })));
  }, [visible, query]);

  const commentsBySegment = useMemo(() => {
    const map = new Map<number, Comment[]>();
    for (const c of comments) map.set(c.segment_id, [...(map.get(c.segment_id) ?? []), c]);
    return map;
  }, [comments]);

  const registerRef = useCallback((id: number, element: HTMLElement | null) => {
    if (element) refs.current.set(id, element);
    else refs.current.delete(id);
  }, []);

  const scrollToSegment = useCallback((id: number | undefined, smooth = true) => {
    if (id === undefined) return;
    refs.current.get(id)?.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Follow playback.
  useEffect(() => {
    if (autoScroll && playing) scrollToSegment(activeId);
  }, [activeId, autoScroll, playing, scrollToSegment]);

  // Explicit jumps (outline, search results, AskFred citations) always scroll there.
  useEffect(() => {
    if (jumpTarget === null || jumpToken === 0) return;
    const segment = segments[Math.max(0, activeIndexAt(starts, jumpTarget))];
    const frame = requestAnimationFrame(() => scrollToSegment(segment?.id));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to new jump requests only
  }, [jumpToken]);

  // The match cursor belongs to one query+filter; a new query starts at its first match.
  const matchKey = `${query}|${JSON.stringify(filter)}`;
  const [cursor, setCursor] = useState({ key: "", index: 0 });
  const matchIndex = cursor.key === matchKey ? Math.min(cursor.index, Math.max(0, matches.length - 1)) : 0;

  useEffect(() => {
    const match = matches[matchIndex];
    if (match) scrollToSegment(match.segmentId);
  }, [matchIndex, matches, scrollToSegment]);

  const step = (delta: number) => {
    if (!matches.length) return;
    if (playing) setAutoScroll(false); // searching shouldn't fight the playhead
    setCursor({ key: matchKey, index: (matchIndex + delta + matches.length) % matches.length });
  };

  const onSeek = useCallback((ms: number, play: boolean) => store.seek(ms, { play }), [store]);
  const onCreateTask = useCallback((segment: Segment) => setTaskSegment(segment), []);
  const onSoundbiteSaved = useCallback(() => openPanel("highlights"), [openPanel]);

  const current = matches[matchIndex];
  const speakerOptions = meeting.speaker_stats.filter((s) => s.participant_id !== null);

  const copyTranscript = () => {
    const text = segments.map((s) => `[${formatTimestamp(s.start_ms)}] ${s.speaker?.name ?? "Unknown"}: ${s.text}`).join("\n");
    void navigator.clipboard?.writeText(text);
    toast.success("Transcript copied");
  };

  return (
    <section aria-label="Transcript" className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-sm font-semibold text-ink">Transcript</h2>
          <span className="text-xs text-ink-subtle">{segments.length} lines</span>
          <div className="ml-auto flex items-center gap-0.5">
            <Menu
              trigger={
                <IconButton label="Filter transcript" size="sm" active={Boolean(filter)} tooltip={false}>
                  <Filter className="size-4" />
                </IconButton>
              }
            >
              <MenuLabel>AI filters</MenuLabel>
              {FLAG_FILTERS.map(({ flag, label }) => (
                <MenuItem key={flag} onSelect={() => setFilter({ kind: "flag", flag })} hint={filter?.kind === "flag" && filter.flag === flag ? "✓" : undefined}>
                  {label}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuLabel>Speakers</MenuLabel>
              {speakerOptions.map((s) => (
                <MenuItem
                  key={s.participant_id}
                  onSelect={() => setFilter({ kind: "speaker", participantId: s.participant_id!, name: s.name })}
                  hint={filter?.kind === "speaker" && filter.participantId === s.participant_id ? "✓" : undefined}
                >
                  {s.name}
                </MenuItem>
              ))}
              {filter && (
                <>
                  <MenuSeparator />
                  <MenuItem icon={<X />} onSelect={() => setFilter(null)}>
                    Clear filter
                  </MenuItem>
                </>
              )}
            </Menu>
            <IconButton
              label={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
              size="sm"
              active={autoScroll}
              onClick={() => {
                setAutoScroll(!autoScroll);
                if (!autoScroll) scrollToSegment(activeId);
              }}
            >
              <Crosshair className="size-4" />
            </IconButton>
            <IconButton label="Copy transcript" size="sm" onClick={copyTranscript}>
              <Copy className="size-4" />
            </IconButton>
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              if (playing) setAutoScroll(false);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                step(event.shiftKey ? -1 : 1);
              }
              if (event.key === "Escape") setSearch("");
            }}
            placeholder="Search in transcript"
            aria-label="Search in transcript"
            className="h-8 w-full rounded-md border border-border bg-surface-raised pr-32 pl-8 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:bg-surface focus:outline-none"
          />
          {query && (
            <div className="absolute top-1/2 right-1 flex -translate-y-1/2 items-center gap-0.5">
              <span className="px-1 font-mono text-xs text-ink-muted tabular-nums" aria-live="polite">
                {matches.length ? `${matchIndex + 1}/${matches.length}` : "0/0"}
              </span>
              <IconButton label="Previous match" size="sm" tooltip={false} disabled={!matches.length} onClick={() => step(-1)}>
                <ChevronUp className="size-4" />
              </IconButton>
              <IconButton label="Next match" size="sm" tooltip={false} disabled={!matches.length} onClick={() => step(1)}>
                <ChevronDown className="size-4" />
              </IconButton>
              <IconButton label="Clear search" size="sm" tooltip={false} onClick={() => setSearch("")}>
                <X className="size-3.5" />
              </IconButton>
            </div>
          )}
        </div>

        {filter && (
          <div className="flex items-center gap-2 text-xs text-ink-muted">
            <span>
              Showing <span className="font-medium text-ink">{visible.length}</span> of {segments.length} lines ·{" "}
              {filter.kind === "flag" ? FLAG_FILTERS.find((f) => f.flag === filter.flag)?.label : filter.name}
            </span>
            <button type="button" onClick={() => setFilter(null)} className="font-medium text-accent-ink hover:underline">
              Clear
            </button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto px-2 py-2"
        // Manual scrolling while playing pauses follow mode.
        onWheel={() => playing && autoScroll && setAutoScroll(false)}
        onTouchMove={() => playing && autoScroll && setAutoScroll(false)}
      >
        {visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-ink-muted">
            {segments.length === 0 ? "This meeting has no transcript." : "No lines match this filter."}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visible.map((segment) => (
              <TranscriptSegment
                key={segment.id}
                meetingId={meeting.id}
                segment={segment}
                slot={slotFor(ui, segment.speaker?.participant_id)}
                active={segment.id === activeId}
                query={query}
                currentOccurrence={current?.segmentId === segment.id ? current.occurrence : null}
                comments={commentsBySegment.get(segment.id) ?? EMPTY}
                participants={meeting.participants}
                onSeek={onSeek}
                onCreateTask={onCreateTask}
                onSoundbiteSaved={onSoundbiteSaved}
                registerRef={registerRef}
              />
            ))}
          </ul>
        )}
      </div>

      {playing && !autoScroll && (
        <div className="pointer-events-none relative">
          <button
            type="button"
            onClick={() => {
              setAutoScroll(true);
              scrollToSegment(activeId);
            }}
            className={cn(
              "pressable pointer-events-auto absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full",
              "bg-surface-inverse px-3 py-1.5 text-xs font-medium text-ink-inverse shadow-elev-3",
            )}
          >
            <Crosshair className="size-3.5" /> Resume auto-scroll
          </button>
        </div>
      )}

      {taskSegment && (
        <NewActionItemDialog
          open
          onOpenChange={(open) => !open && setTaskSegment(null)}
          initialText={taskSegment.text}
          segmentId={taskSegment.id}
          defaultAssigneeId={meeting.participants.find((p) => p.id === taskSegment.speaker?.participant_id)?.person_id ?? null}
        />
      )}
    </section>
  );
}
