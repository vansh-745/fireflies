"use client";

import { Plus, SearchX, Share2, Video } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Tabs } from "@/components/ui/tabs";
import { dayGroupLabel } from "@/lib/format";
import { useMeetings } from "@/lib/queries";
import type { MeetingListItem } from "@/lib/types";

import { useOpenCreateMeeting } from "./create-meeting-dialog";
import { MeetingFiltersBar, toApiFilters, useFilterState } from "./meeting-filters";
import { MeetingRow } from "./meeting-row";

type Tab = "mine" | "shared";

function groupByDay(meetings: MeetingListItem[]) {
  const groups: { label: string; items: MeetingListItem[] }[] = [];
  for (const meeting of meetings) {
    const label = dayGroupLabel(meeting.started_at);
    const last = groups.at(-1);
    if (last?.label === label) last.items.push(meeting);
    else groups.push({ label, items: [meeting] });
  }
  return groups;
}

export function MeetingsLibrary() {
  const [tab, setTab] = useState<Tab>("mine");
  const [state, update] = useFilterState();
  const filters = useMemo(() => toApiFilters(state), [state]);
  const query = useMeetings(filters);
  const openCreate = useOpenCreateMeeting();

  const meetings = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  // Date groups only make sense for chronological sorts.
  const grouped = state.sort === "newest" || state.sort === "oldest";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Meetings</h1>
          <p className="mt-1 text-sm text-ink-muted">Transcripts, AI notes and action items from every conversation.</p>
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => openCreate()}>
          New meeting
        </Button>
      </div>

      <Tabs<Tab>
        className="mt-6"
        value={tab}
        onChange={setTab}
        items={[
          { value: "mine", label: "My meetings", count: tab === "mine" && !query.isLoading ? total : undefined },
          { value: "shared", label: "Shared with me" },
        ]}
      />

      {tab === "shared" ? (
        <EmptyState
          className="mt-8"
          icon={<Share2 />}
          title="Team sharing is coming soon"
          description="Meetings your teammates share with you will show up here once workspaces and sharing are available."
        />
      ) : (
        <>
          <div className="mt-5">
            <MeetingFiltersBar state={state} update={update} />
          </div>

          <Card className="mt-4 overflow-hidden">
            {query.isLoading ? (
              <ul className="divide-y divide-border">
                {Array.from({ length: 6 }, (_, i) => (
                  <li key={i} className="flex items-center gap-4 px-5 py-4">
                    <Skeleton className="size-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : query.isError ? (
              <EmptyState
                icon={<Video />}
                title="Couldn't load meetings"
                description={query.error.message}
                action={<Button onClick={() => void query.refetch()}>Try again</Button>}
              />
            ) : meetings.length === 0 ? (
              total === 0 && !state.q && !state.people.length && !state.tags.length && state.range === "any" ? (
                <EmptyState
                  icon={<Video />}
                  title="No meetings yet"
                  description="Upload or paste a transcript and Fred will write the notes."
                  action={<Button variant="primary" onClick={() => openCreate()}>New meeting</Button>}
                />
              ) : (
                <EmptyState icon={<SearchX />} title="No meetings match these filters" description="Try a different search or clear some filters." />
              )
            ) : grouped ? (
              groupByDay(meetings).map((group) => (
                <section key={group.label} aria-label={group.label}>
                  <h2 className="border-b border-border bg-surface-raised px-5 py-2 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
                    {group.label}
                  </h2>
                  <ul className="divide-y divide-border">
                    {group.items.map((meeting) => (
                      <MeetingRow key={meeting.id} meeting={meeting} />
                    ))}
                  </ul>
                </section>
              ))
            ) : (
              <ul className="divide-y divide-border">
                {meetings.map((meeting) => (
                  <MeetingRow key={meeting.id} meeting={meeting} />
                ))}
              </ul>
            )}
          </Card>

          {query.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button loading={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                Load more meetings
              </Button>
            </div>
          )}
          {!query.isLoading && meetings.length > 0 && (
            <p className="mt-3 text-center text-xs text-ink-subtle">
              Showing {meetings.length} of {total} meeting{total === 1 ? "" : "s"}
            </p>
          )}
        </>
      )}
    </div>
  );
}
