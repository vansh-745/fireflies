"use client";

import { AlignLeft, Copy, Hash, ListChecks, ListTree, Pencil, RefreshCw, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button, IconButton } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/field";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { usePlayer } from "@/lib/player";
import { useRegenerateSummary, useUpdateSummary } from "@/lib/queries";
import type { MeetingDetail } from "@/lib/types";

import { ActionItemsSection } from "./action-items";
import { useMeetingUI } from "./meeting-context";
import { RichText } from "./rich-text";

function Section({ icon, title, children, action }: { icon: ReactNode; title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-b border-border px-5 py-5 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex size-6 items-center justify-center rounded-md bg-accent-subtle text-accent-ink [&>svg]:size-3.5">{icon}</span>
        <h3 className="font-display text-sm font-semibold text-ink">{title}</h3>
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}

function sourceLabel(meeting: MeetingDetail): string {
  const summary = meeting.summary;
  if (!summary) return "";
  if (summary.generated_by === "llm") return "Written by Fred (Claude)";
  if (summary.generated_by === "heuristic") return "Offline AI notes";
  return "AI notes";
}

function notesAsText(meeting: MeetingDetail): string {
  const s = meeting.summary;
  const lines = [meeting.title, ""];
  if (s) lines.push(s.gist, "", s.overview, "", `Keywords: ${s.keywords.join(", ")}`, "");
  if (meeting.chapters.length) {
    lines.push("Outline");
    meeting.chapters.forEach((c) => lines.push(`[${formatTimestamp(c.start_ms)}] ${c.title}`, ...c.bullets.map((b) => `  - ${b}`)));
    lines.push("");
  }
  if (meeting.action_items.length) {
    lines.push("Action items");
    meeting.action_items.forEach((a) => lines.push(`[${a.is_completed ? "x" : " "}] ${a.text}${a.assignee ? ` — ${a.assignee.name}` : ""}`));
  }
  return lines.join("\n");
}

function Outline() {
  const { meeting, jumpTo } = useMeetingUI();
  const chapters = meeting.chapters;
  // Highlight the chapter under the playhead.
  const activeId = usePlayer((s) => [...chapters].reverse().find((c) => c.start_ms <= s.currentMs)?.id ?? null);

  return (
    <ol className="flex flex-col gap-1">
      {chapters.map((chapter) => {
        const active = chapter.id === activeId;
        return (
          <li key={chapter.id}>
            <button
              type="button"
              onClick={() => jumpTo(chapter.start_ms, { play: true })}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left",
                active ? "bg-accent-subtle" : "hover:bg-surface-raised",
              )}
            >
              <span className="mt-0.5 shrink-0 rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent-ink tabular-nums">
                {formatTimestamp(chapter.start_ms)}
              </span>
              <span className="min-w-0">
                <span className={cn("block text-sm font-semibold", active ? "text-accent-ink" : "text-ink")}>{chapter.title}</span>
                {chapter.bullets.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {chapter.bullets.map((bullet, i) => (
                      <li key={i} className="flex gap-2 text-[13px] leading-5 text-ink-muted">
                        <span aria-hidden className="mt-2 size-1 shrink-0 rounded-full bg-ink-subtle" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function NotesPanel() {
  const { meeting, setSearch } = useMeetingUI();
  const regenerate = useRegenerateSummary(meeting.id);
  const updateSummary = useUpdateSummary(meeting.id);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const summary = meeting.summary;
  const processing = summary?.status === "processing" || regenerate.isPending;

  const runRegenerate = () =>
    regenerate.mutate(undefined, {
      onSuccess: (m) =>
        toast.success(m.summary?.status === "processing" ? "Fred is rewriting the notes…" : "AI notes regenerated", {
          description: "Open, AI-suggested action items were refreshed; yours and completed ones were kept.",
        }),
    });

  return (
    <section aria-label="AI notes" className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <Sparkles className="size-4 text-accent" aria-hidden />
        <h2 className="font-display text-sm font-semibold text-ink">AI Notes</h2>
        {summary && <span className="truncate text-xs text-ink-subtle">· {sourceLabel(meeting)}</span>}
        <div className="ml-auto flex items-center gap-0.5">
          {summary && (
            <IconButton label="Copy notes" size="sm" onClick={() => {
              void navigator.clipboard?.writeText(notesAsText(meeting));
              toast.success("Notes copied");
            }}>
              <Copy className="size-4" />
            </IconButton>
          )}
          {meeting.segment_count > 0 && (
            <IconButton label="Regenerate AI notes" size="sm" disabled={processing} onClick={runRegenerate}>
              <RefreshCw className={cn("size-4", processing && "spin")} />
            </IconButton>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {processing && (
          <div className="flex items-center gap-3 border-b border-border bg-accent-subtle px-5 py-3 text-sm text-accent-ink" role="status">
            <Sparkles className="size-4 shrink-0" aria-hidden />
            Fred is writing your notes — this page updates when they&apos;re ready.
          </div>
        )}

        {!summary ? (
          meeting.segment_count === 0 ? (
            <div>
              <EmptyState
                icon={<Sparkles />}
                title="No transcript, no AI notes"
                description="This meeting was created manually. You can still track action items below."
              />
              <Section icon={<ListChecks />} title="Action items">
                <ActionItemsSection />
              </Section>
            </div>
          ) : (
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )
        ) : (
          <>
            <div className="px-5 pt-5">
              <p className={cn("text-md leading-6 font-medium text-ink", processing && "shimmer")}>{summary.gist}</p>
            </div>

            {summary.keywords.length > 0 && (
              <Section icon={<Hash />} title="Keywords">
                <div className="flex flex-wrap gap-1.5">
                  {summary.keywords.map((keyword) => (
                    <Tooltip key={keyword} content="Find in transcript">
                      <span>
                        <Chip onClick={() => setSearch(keyword)}>{keyword}</Chip>
                      </span>
                    </Tooltip>
                  ))}
                </div>
              </Section>
            )}

            <Section
              icon={<AlignLeft />}
              title="Overview"
              action={
                !editing && (
                  <IconButton label="Edit overview" size="sm" disabled={processing} onClick={() => { setDraft(summary.overview); setEditing(true); }}>
                    <Pencil className="size-3.5" />
                  </IconButton>
                )
              }
            >
              {editing ? (
                <div className="flex flex-col gap-2">
                  <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} className="min-h-40 text-sm" autoFocus aria-label="Overview" />
                  <p className="text-xs text-ink-subtle">Start a line with “- ” for a bullet.</p>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={updateSummary.isPending}
                      onClick={() =>
                        updateSummary.mutate({ overview: draft }, { onSuccess: () => { setEditing(false); toast.success("Overview saved"); } })
                      }
                    >
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <RichText text={summary.overview} className={cn("flex flex-col gap-2 text-sm leading-6 text-ink-muted", processing && "opacity-60")} />
              )}
            </Section>

            {meeting.chapters.length > 0 && (
              <Section icon={<ListTree />} title="Outline">
                <Outline />
              </Section>
            )}

            <Section icon={<ListChecks />} title="Action items">
              <ActionItemsSection />
            </Section>
          </>
        )}
      </div>
    </section>
  );
}
