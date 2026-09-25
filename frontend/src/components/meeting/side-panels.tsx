"use client";

import { CalendarClock, CircleHelp, Hash, ListChecks, MessageSquare, Play, Scissors, Trash2, TrendingUp, type LucideIcon } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { usePlayerStore } from "@/lib/player";
import { useComments, useDeleteComment, useDeleteSoundbite, useSoundbites } from "@/lib/queries";
import type { SegmentFlag } from "@/lib/types";

import { slotFor, useMeetingUI } from "./meeting-context";

function PanelHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="px-4 pt-4 pb-2 text-xxs font-semibold tracking-wide text-ink-subtle uppercase">{children}</h3>;
}

const FLAG_META: { flag: SegmentFlag; label: string; icon: LucideIcon }[] = [
  { flag: "question", label: "Questions", icon: CircleHelp },
  { flag: "task", label: "Tasks", icon: ListChecks },
  { flag: "metric", label: "Metrics", icon: TrendingUp },
  { flag: "date", label: "Dates & times", icon: CalendarClock },
];

export function SmartSearchPanel() {
  const ui = useMeetingUI();
  const { segments, filter, setFilter, meeting, setSearch, search } = ui;

  const counts = useMemo(() => {
    const result: Record<SegmentFlag, number> = { question: 0, task: 0, metric: 0, date: 0 };
    segments.forEach((s) => s.flags.forEach((f) => (result[f] += 1)));
    return result;
  }, [segments]);

  return (
    <div className="pb-4">
      <PanelHeading>AI filters</PanelHeading>
      <ul className="flex flex-col gap-0.5 px-2">
        {FLAG_META.map(({ flag, label, icon: Icon }) => {
          const active = filter?.kind === "flag" && filter.flag === flag;
          return (
            <li key={flag}>
              <button
                type="button"
                disabled={!counts[flag]}
                aria-pressed={active}
                onClick={() => setFilter(active ? null : { kind: "flag", flag })}
                className={cn(
                  "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50",
                  active ? "bg-accent-subtle font-medium text-accent-ink" : "text-ink hover:bg-surface-sunken",
                )}
              >
                <Icon className="size-4 shrink-0 text-accent" aria-hidden />
                <span className="flex-1 text-left">{label}</span>
                <span className="text-xs text-ink-subtle tabular-nums">{counts[flag]}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <PanelHeading>Speakers</PanelHeading>
      <ul className="flex flex-col gap-0.5 px-2">
        {meeting.speaker_stats.map((stat) => {
          const active = filter?.kind === "speaker" && filter.participantId === stat.participant_id;
          const slot = slotFor(ui, stat.participant_id);
          return (
            <li key={stat.participant_id ?? "unknown"}>
              <button
                type="button"
                disabled={stat.participant_id === null}
                aria-pressed={active}
                onClick={() => stat.participant_id !== null && setFilter(active ? null : { kind: "speaker", participantId: stat.participant_id, name: stat.name })}
                className={cn("flex w-full flex-col gap-1.5 rounded-md px-2 py-2 text-left", active ? "bg-accent-subtle" : "hover:bg-surface-sunken")}
              >
                <span className="flex w-full items-center gap-2">
                  <Avatar name={stat.name} slot={slot} size="xs" />
                  <span className={cn("flex-1 truncate text-sm", active ? "font-medium text-accent-ink" : "text-ink")}>{stat.name}</span>
                  <span className="text-xs text-ink-subtle tabular-nums">{Math.round(stat.talk_percent)}%</span>
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-surface-sunken">
                  <span
                    className="block h-full origin-left rounded-full"
                    style={{ transform: `scaleX(${stat.talk_percent / 100})`, background: `var(--speaker-${slot})` }}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {meeting.summary && meeting.summary.keywords.length > 0 && (
        <>
          <PanelHeading>Topics</PanelHeading>
          <div className="flex flex-wrap gap-1.5 px-4">
            {meeting.summary.keywords.map((keyword) => (
              <Chip key={keyword} icon={<Hash className="size-3" />} active={search.toLowerCase() === keyword.toLowerCase()} onClick={() => setSearch(search === keyword ? "" : keyword)}>
                {keyword}
              </Chip>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function StatsPanel() {
  const ui = useMeetingUI();
  const stats = ui.meeting.speaker_stats;
  const totals = useMemo(
    () => ({
      words: stats.reduce((n, s) => n + s.word_count, 0),
      questions: stats.reduce((n, s) => n + s.questions, 0),
    }),
    [stats],
  );

  return (
    <div className="pb-4">
      <PanelHeading>Meeting</PanelHeading>
      <dl className="grid grid-cols-2 gap-2 px-4">
        {[
          ["Speakers", stats.filter((s) => s.participant_id !== null).length],
          ["Words", totals.words.toLocaleString()],
          ["Questions", totals.questions],
          ["Lines", ui.meeting.segment_count],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-surface-raised px-3 py-2">
            <dt className="text-xxs text-ink-subtle uppercase">{label}</dt>
            <dd className="font-display text-lg font-semibold text-ink tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <PanelHeading>Talk time</PanelHeading>
      <ul className="flex flex-col gap-3 px-4">
        {stats.map((stat) => {
          const slot = slotFor(ui, stat.participant_id);
          return (
            <li key={stat.participant_id ?? "unknown"}>
              <div className="flex items-center gap-2">
                <Avatar name={stat.name} slot={slot} size="sm" />
                <span className="flex-1 truncate text-sm font-medium text-ink">{stat.name}</span>
                <span className="text-sm font-semibold text-ink tabular-nums">{Math.round(stat.talk_percent)}%</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                <div className="h-full origin-left rounded-full" style={{ transform: `scaleX(${stat.talk_percent / 100})`, background: `var(--speaker-${slot})` }} />
              </div>
              <div className="mt-1 flex justify-between text-xxs text-ink-subtle">
                <span>{stat.words_per_minute} wpm · {stat.questions} questions</span>
                <span>Longest {formatTimestamp(stat.longest_monologue_ms)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 px-4 text-xxs text-ink-subtle">Sentiment and topic trends are coming soon.</p>
    </div>
  );
}

export function HighlightsPanel() {
  const { meeting, jumpTo } = useMeetingUI();
  const store = usePlayerStore();
  const { data: soundbites = [] } = useSoundbites(meeting.id);
  const { data: comments = [] } = useComments(meeting.id);
  const deleteSoundbite = useDeleteSoundbite(meeting.id);
  const deleteComment = useDeleteComment(meeting.id);

  return (
    <div className="pb-4">
      <PanelHeading>Soundbites · {soundbites.length}</PanelHeading>
      {soundbites.length === 0 ? (
        <p className="px-4 text-xs text-ink-muted">
          Hover a transcript line and press <Scissors className="inline size-3" aria-label="scissors" /> to save a clip.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 px-2">
          {soundbites.map((bite) => (
            <li key={bite.id} className="group flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-sunken">
              <IconButton
                label="Play soundbite"
                size="sm"
                className="bg-accent-subtle text-accent-ink"
                onClick={() => {
                  store.playRange(bite.start_ms, bite.end_ms);
                  jumpTo(bite.start_ms, { play: true });
                }}
              >
                <Play className="size-3.5 fill-current" />
              </IconButton>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{bite.title}</div>
                <div className="font-mono text-xxs text-ink-subtle tabular-nums">
                  {formatTimestamp(bite.start_ms)} – {formatTimestamp(bite.end_ms)}
                </div>
              </div>
              <IconButton
                label="Delete soundbite"
                size="sm"
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={() => deleteSoundbite.mutate(bite.id, { onSuccess: () => toast.success("Soundbite deleted") })}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <PanelHeading>Comments · {comments.length}</PanelHeading>
      {comments.length === 0 ? (
        <p className="px-4 text-xs text-ink-muted">
          Comment on any transcript line with <MessageSquare className="inline size-3" aria-label="comment" />.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 px-2">
          {comments.map((comment) => (
            <li key={comment.id} className="group flex gap-2 rounded-md px-2 py-2 hover:bg-surface-sunken">
              <Avatar name={comment.author.name} slot={1} size="xs" className="mt-0.5" />
              <button type="button" onClick={() => jumpTo(comment.start_ms)} className="min-w-0 flex-1 text-left">
                <span className="block text-sm text-ink">{comment.body}</span>
                <span className="text-xxs text-ink-subtle">
                  {comment.author.name} · <span className="font-mono">{formatTimestamp(comment.start_ms)}</span>
                </span>
              </button>
              <IconButton
                label="Delete comment"
                size="sm"
                className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                onClick={() => deleteComment.mutate(comment.id)}
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

