"use client";

import { format } from "date-fns";
import { ArrowRight, CalendarPlus, CircleCheck, ClipboardPaste, Clock, FileUp, ListChecks, Radio, Users, Video } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useOpenCreateMeeting } from "@/components/meetings/create-meeting-dialog";
import { PlatformIcon } from "@/components/meetings/platform-icon";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, ComingSoonBadge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { TaskCheckbox } from "@/components/ui/field";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { firstName, formatDueDate, formatDuration, formatMeetingDate, formatMinutes, formatTimestamp, greeting } from "@/lib/format";
import { useActionItems, useMe, usePeople, useRecentMeetings, useStats, useToggleActionItem } from "@/lib/queries";

function StatCard({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-ink-muted">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent-subtle text-accent-ink [&>svg]:size-4">{icon}</span>
        {label}
      </div>
      <div className="mt-3 font-display text-2xl font-semibold text-ink tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-subtle">{hint}</div>}
    </Card>
  );
}

function QuickAction({ icon, title, description, onClick, soon }: { icon: React.ReactNode; title: string; description: string; onClick: () => void; soon?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left shadow-elev-1 hover:border-accent"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-ink [&>svg]:size-[18px]">{icon}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {title}
          {soon && <ComingSoonBadge />}
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
    </button>
  );
}

type TaskTab = "open" | "mine" | "done";

function ActionItemsCard() {
  const [tab, setTab] = useState<TaskTab>("open");
  const { data: me } = useMe();
  const { data: people = [] } = usePeople();
  const myPersonId = people.find((p) => p.email && me && p.email.toLowerCase() === me.email.toLowerCase())?.id;
  const params = useMemo(
    () => ({ completed: tab === "done", assigneeId: tab === "mine" ? myPersonId ?? -1 : undefined, limit: 8 }),
    [tab, myPersonId],
  );
  const { data: items, isLoading } = useActionItems(params);
  const toggle = useToggleActionItem();

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="font-display text-base font-semibold text-ink">Action items</h2>
      </div>
      <Tabs<TaskTab>
        className="mx-5 mt-1"
        value={tab}
        onChange={setTab}
        items={[
          { value: "open", label: "All open" },
          { value: "mine", label: "Assigned to me" },
          { value: "done", label: "Completed" },
        ]}
      />
      <div className="flex-1 p-2">
        {isLoading ? (
          <div className="space-y-3 p-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : !items?.length ? (
          <EmptyState
            icon={<CircleCheck />}
            title={tab === "done" ? "Nothing completed yet" : "You're all caught up"}
            description={tab === "mine" ? "No open action items are assigned to you." : undefined}
          />
        ) : (
          <ul>
            {items.map((item) => {
              const due = item.due_date ? formatDueDate(item.due_date) : null;
              return (
                <li key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-raised">
                  <span className="pt-0.5">
                    <TaskCheckbox
                      checked={item.is_completed}
                      label={`Mark “${item.text}” as ${item.is_completed ? "not done" : "done"}`}
                      onChange={(done) =>
                        toggle.mutate(
                          { id: item.id, meetingId: item.meeting_id, done },
                          { onSuccess: () => done && toast.success("Action item completed") },
                        )
                      }
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", item.is_completed ? "text-ink-subtle line-through" : "text-ink")}>{item.text}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
                      <Link
                        href={`/meetings/${item.meeting.id}${item.start_ms !== null ? `?t=${item.start_ms}` : ""}`}
                        className="truncate font-medium text-accent-ink hover:underline"
                      >
                        {item.meeting.title}
                        {item.start_ms !== null && ` · ${formatTimestamp(item.start_ms)}`}
                      </Link>
                      {item.assignee && <span>· {item.assignee.name}</span>}
                      {due && <span className={cn(due.overdue && !item.is_completed && "font-medium text-danger")}>· {due.label}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

export function HomeDashboard() {
  const openCreate = useOpenCreateMeeting();
  const { data: me } = useMe();
  const { data: stats } = useStats();
  const { data: recent, isLoading: recentLoading } = useRecentMeetings(5);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8">
      <p className="text-sm text-ink-muted">{format(new Date(), "EEEE, MMMM d")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-ink">
        {greeting()}, {me ? firstName(me.name) : "there"}
      </h1>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <QuickAction icon={<FileUp />} title="Upload a transcript" description=".txt, .vtt, .srt or .json — AI notes in seconds" onClick={() => openCreate({ mode: "upload" })} />
        <QuickAction icon={<ClipboardPaste />} title="Paste a transcript" description="Drop in text from any meeting tool" onClick={() => openCreate({ mode: "paste" })} />
        <QuickAction
          icon={<Radio />}
          title="Capture a live meeting"
          description="Invite Fred to Zoom, Meet or Teams"
          soon
          onClick={() => toast("The live meeting bot is coming soon", { description: "Upload or paste a transcript in the meantime." })}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Video />} label="Meetings this week" value={stats?.meetings_this_week ?? "–"} hint={stats ? `${stats.meetings_total} in total` : undefined} />
        <StatCard icon={<Clock />} label="Time transcribed" value={stats ? formatMinutes(stats.minutes_this_week) : "–"} hint={stats ? `${formatMinutes(stats.minutes_total)} all time` : undefined} />
        <StatCard icon={<ListChecks />} label="Open action items" value={stats?.open_action_items ?? "–"} hint={stats ? `${stats.completed_action_items} completed` : undefined} />
        <StatCard icon={<Users />} label="People" value={stats?.people_total ?? "–"} hint="across all meetings" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h2 className="font-display text-base font-semibold text-ink">Recent meetings</h2>
            <Link href="/meetings" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
              View all <ArrowRight className="size-3.5" />
            </Link>
          </div>
          {recentLoading ? (
            <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !recent?.items.length ? (
            <EmptyState icon={<Video />} title="No meetings yet" action={<Button variant="primary" onClick={() => openCreate()}>New meeting</Button>} />
          ) : (
            <ul className="divide-y divide-border">
              {recent.items.map((meeting) => (
                <li key={meeting.id} className="relative flex items-center gap-3 px-5 py-3 hover:bg-surface-raised">
                  <PlatformIcon platform={meeting.platform} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/meetings/${meeting.id}`} className="block truncate text-sm font-medium text-ink after:absolute after:inset-0">
                      {meeting.title}
                    </Link>
                    <div className="text-xs text-ink-subtle">
                      {formatMeetingDate(meeting.started_at)} · {formatDuration(meeting.duration_seconds)}
                    </div>
                  </div>
                  <AvatarStack names={meeting.participants.map((p) => p.name)} max={3} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <ActionItemsCard />
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <CalendarPlus className="size-5 text-accent" aria-hidden />
              <h2 className="font-display text-base font-semibold text-ink">Upcoming meetings</h2>
              <ComingSoonBadge className="ml-auto" />
            </div>
            <p className="mt-2 text-sm text-ink-muted">Connect Google or Outlook calendar and Fred will join and take notes automatically.</p>
            <Button
              className="mt-4"
              size="sm"
              onClick={() => toast("Calendar integrations are coming soon")}
            >
              Connect calendar
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
