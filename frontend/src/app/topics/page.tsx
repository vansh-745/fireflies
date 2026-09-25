"use client";

import { ArrowRight, Hash, Tags } from "lucide-react";
import Link from "next/link";

import { speakerStyle, tagSlot } from "@/lib/colors";
import { Card, ComingSoonBadge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { useTags } from "@/lib/queries";

/** Topic Tracker: meeting tags with counts; each opens the library filtered by that topic. */
export default function TopicsPage() {
  const { data: tags, isLoading } = useTags();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Topic Tracker</h1>
      <p className="mt-1 text-sm text-ink-muted">Topics you tag meetings with. Pick one to see every meeting about it.</p>

      {isLoading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : !tags?.length ? (
        <EmptyState className="mt-8" icon={<Tags />} title="No topics yet" description="Add tags when you create or edit a meeting." />
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Link href={`/meetings?tag=${tag.id}`} className="pressable group block">
                <Card className="flex items-center gap-3 p-4 group-hover:border-accent">
                  <span
                    style={speakerStyle(tagSlot(tag.color))}
                    className="flex size-10 items-center justify-center rounded-lg bg-(--chip-bg) text-(--chip-ink)"
                  >
                    <Hash className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{tag.name}</span>
                    <span className="text-xs text-ink-subtle">
                      {tag.meeting_count} meeting{tag.meeting_count === 1 ? "" : "s"}
                    </span>
                  </span>
                  <ArrowRight className="size-4 text-ink-subtle group-hover:text-accent" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Card className="mt-8 flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
        <div className="flex-1">
          <div className="flex items-center gap-2 font-medium text-ink">
            Keyword trackers <ComingSoonBadge />
          </div>
          <p className="mt-1 text-sm text-ink-muted">Track mentions of competitors, pricing or any phrase across every meeting automatically.</p>
        </div>
      </Card>
    </div>
  );
}
