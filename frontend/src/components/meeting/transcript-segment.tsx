"use client";

import { Check, Copy, Ellipsis, ListPlus, MessageSquare, Pencil, Scissors, Trash2, UserRound, X } from "lucide-react";
import { memo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Menu, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { useAddComment, useAddSoundbite, useDeleteComment, useUpdateSegment } from "@/lib/queries";
import type { Comment, Participant, Segment } from "@/lib/types";

const FLAG_LABELS: Record<string, string> = { question: "Question", metric: "Metric", date: "Date", task: "Task" };

/** Wrap every case-insensitive occurrence of `query` in <mark>. */
export function highlight(text: string, query: string, currentOccurrence: number | null): ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const parts: ReactNode[] = [];
  let from = 0;
  let occurrence = 0;
  for (let at = lower.indexOf(query); at !== -1; at = lower.indexOf(query, at + query.length)) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={at} data-current={occurrence === currentOccurrence}>
        {text.slice(at, at + query.length)}
      </mark>,
    );
    from = at + query.length;
    occurrence += 1;
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}

interface SegmentProps {
  meetingId: number;
  segment: Segment;
  slot: number;
  active: boolean;
  query: string;
  currentOccurrence: number | null;
  comments: Comment[];
  participants: Participant[];
  onSeek: (ms: number, play: boolean) => void;
  onCreateTask: (segment: Segment) => void;
  onSoundbiteSaved: () => void;
  registerRef: (id: number, element: HTMLElement | null) => void;
}

export const TranscriptSegment = memo(function TranscriptSegment({
  meetingId,
  segment,
  slot,
  active,
  query,
  currentOccurrence,
  comments,
  participants,
  onSeek,
  onCreateTask,
  onSoundbiteSaved,
  registerRef,
}: SegmentProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(segment.text);
  const [threadOpen, setThreadOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const updateSegment = useUpdateSegment(meetingId);
  const addComment = useAddComment(meetingId);
  const deleteComment = useDeleteComment(meetingId);
  const addSoundbite = useAddSoundbite(meetingId);
  const speakerName = segment.speaker?.name ?? "Unknown speaker";

  const saveEdit = () => {
    const text = draft.trim();
    if (!text || text === segment.text) {
      setEditing(false);
      return;
    }
    updateSegment.mutate(
      { segmentId: segment.id, text },
      { onSuccess: () => { setEditing(false); toast.success("Transcript updated"); } },
    );
  };

  const saveClip = () => {
    const words = segment.text.split(/\s+/);
    const title = words.slice(0, 8).join(" ").replace(/[.,;:!?]$/, "") + (words.length > 8 ? "…" : "");
    addSoundbite.mutate(
      { title, start_ms: segment.start_ms, end_ms: Math.max(segment.end_ms, segment.start_ms + 1000) },
      { onSuccess: () => toast.success("Soundbite saved", { action: { label: "View", onClick: onSoundbiteSaved } }) },
    );
  };

  const submitComment = () => {
    const body = commentDraft.trim();
    if (!body) return;
    addComment.mutate({ segmentId: segment.id, body }, { onSuccess: () => setCommentDraft("") });
  };

  return (
    <li
      ref={(element) => registerRef(segment.id, element)}
      data-segment-id={segment.id}
      className={cn(
        "group relative flex gap-3 rounded-lg border-l-2 px-3 py-2.5",
        active ? "border-accent bg-accent-subtle" : "border-transparent hover:bg-surface-raised",
      )}
    >
      <Avatar name={speakerName} slot={slot} size="md" className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Menu
            align="start"
            trigger={
              <button type="button" className="truncate text-sm font-semibold text-ink hover:underline" aria-label={`Speaker: ${speakerName}. Change speaker`}>
                {speakerName}
              </button>
            }
          >
            <MenuLabel>Change speaker</MenuLabel>
            {participants.map((p) => (
              <MenuItem
                key={p.id}
                icon={<UserRound />}
                hint={p.id === segment.speaker?.participant_id ? "✓" : undefined}
                onSelect={() =>
                  p.id !== segment.speaker?.participant_id &&
                  updateSegment.mutate({ segmentId: segment.id, speaker_participant_id: p.id }, { onSuccess: () => toast.success(`Speaker set to ${p.name}`) })
                }
              >
                {p.name}
              </MenuItem>
            ))}
          </Menu>
          <button
            type="button"
            onClick={() => onSeek(segment.start_ms, true)}
            className="font-mono text-xs text-ink-subtle tabular-nums hover:text-accent-ink hover:underline"
            aria-label={`Play from ${formatTimestamp(segment.start_ms)}`}
          >
            {formatTimestamp(segment.start_ms)}
          </button>
          {segment.flags
            .filter((f) => f !== "date" && f !== "metric")
            .map((flag) => (
              <span key={flag} className="rounded bg-surface-sunken px-1.5 text-xxs font-medium text-ink-muted">
                {FLAG_LABELS[flag]}
              </span>
            ))}
          {segment.comment_count > 0 && (
            <button
              type="button"
              onClick={() => setThreadOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full bg-warning-subtle px-1.5 text-xxs font-semibold text-warning"
              aria-label={`${segment.comment_count} comments`}
            >
              <MessageSquare className="size-3" />
              {segment.comment_count}
            </button>
          )}
        </div>

        {editing ? (
          <div className="mt-1.5 flex flex-col gap-2">
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              autoFocus
              className="min-h-20"
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) saveEdit();
                if (event.key === "Escape") setEditing(false);
              }}
            />
            <div className="flex gap-2">
              <button type="button" onClick={saveEdit} className="pressable inline-flex h-7 items-center gap-1 rounded-md bg-accent px-2.5 text-xs font-medium text-on-accent">
                <Check className="size-3.5" /> Save
              </button>
              <button type="button" onClick={() => { setEditing(false); setDraft(segment.text); }} className="pressable inline-flex h-7 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-medium text-ink">
                <X className="size-3.5" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            onClick={() => {
              // Don't hijack text selection.
              if (!window.getSelection()?.toString()) onSeek(segment.start_ms, false);
            }}
            className="mt-0.5 cursor-pointer text-sm leading-6 text-ink"
          >
            {highlight(segment.text, query, currentOccurrence)}
          </p>
        )}

        {threadOpen && (
          <div className="mt-2 rounded-lg border border-border bg-surface p-2.5">
            <ul className="flex flex-col gap-2">
              {comments.map((comment) => (
                <li key={comment.id} className="group/comment flex gap-2 text-sm">
                  <Avatar name={comment.author.name} size="xs" slot={1} className="mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="font-medium text-ink">{comment.author.name}</span>{" "}
                    <span className="text-ink-muted">{comment.body}</span>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete comment"
                    onClick={() => deleteComment.mutate(comment.id)}
                    className="text-ink-subtle opacity-0 group-hover/comment:opacity-100 hover:text-danger focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                submitComment();
              }}
            >
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Add a comment…"
                aria-label="Add a comment"
                autoFocus={comments.length === 0}
                className="h-8 flex-1 rounded-md border border-border bg-surface px-2.5 text-sm text-ink placeholder:text-ink-subtle focus:border-accent focus:outline-none"
              />
              <button type="submit" disabled={!commentDraft.trim() || addComment.isPending} className="pressable h-8 rounded-md bg-accent px-3 text-xs font-medium text-on-accent disabled:opacity-50">
                Comment
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Hover actions */}
      {!editing && (
        <div className="absolute top-1.5 right-2 flex items-center gap-0.5 rounded-md border border-border bg-surface-overlay p-0.5 opacity-0 shadow-elev-1 group-focus-within:opacity-100 group-hover:opacity-100">
          <IconButton label="Comment" size="sm" onClick={() => setThreadOpen(true)}>
            <MessageSquare className="size-3.5" />
          </IconButton>
          <IconButton label="Save as soundbite" size="sm" onClick={saveClip}>
            <Scissors className="size-3.5" />
          </IconButton>
          <IconButton label="Create action item" size="sm" onClick={() => onCreateTask(segment)}>
            <ListPlus className="size-3.5" />
          </IconButton>
          <Menu
            trigger={
              <IconButton label="More" size="sm" tooltip={false}>
                <Ellipsis className="size-3.5" />
              </IconButton>
            }
          >
            <MenuItem
              icon={<Copy />}
              onSelect={() => {
                void navigator.clipboard?.writeText(`[${formatTimestamp(segment.start_ms)}] ${speakerName}: ${segment.text}`);
                toast.success("Copied to clipboard");
              }}
            >
              Copy line
            </MenuItem>
            <MenuItem icon={<Pencil />} onSelect={() => { setDraft(segment.text); setEditing(true); }}>
              Edit text
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon={<MessageSquare />} onSelect={() => setThreadOpen(true)}>
              {segment.comment_count ? "View comments" : "Add comment"}
            </MenuItem>
          </Menu>
        </div>
      )}
    </li>
  );
});
