"use client";

import { format } from "date-fns";
import { CircleCheck, Clock, ListChecks } from "lucide-react";
import Link from "next/link";

import { AvatarStack } from "@/components/ui/avatar";
import { TagChip } from "@/components/ui/chip";
import { formatDuration } from "@/lib/format";
import type { MeetingListItem } from "@/lib/types";

import { MeetingRowActions } from "./meeting-actions";
import { PlatformIcon } from "./platform-icon";

export function MeetingRow({ meeting }: { meeting: MeetingListItem }) {
  const allDone = meeting.action_items_total > 0 && meeting.action_items_open === 0;
  return (
    <li className="group relative flex items-center gap-4 px-5 py-3.5 transition-colors duration-(--duration-press) ease-(--ease-hover) hover:bg-surface-raised">
      <PlatformIcon platform={meeting.platform} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/meetings/${meeting.id}`}
          className="block truncate font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
        >
          {meeting.title}
        </Link>
        <p className="mt-0.5 truncate text-[13px] text-ink-muted">{meeting.gist || "No AI notes yet"}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle md:hidden">
          <span>{format(new Date(meeting.started_at), "h:mm a")}</span>
          <span>{formatDuration(meeting.duration_seconds)}</span>
        </div>
      </div>

      <div className="hidden w-40 shrink-0 flex-wrap justify-end gap-1 lg:flex">
        {meeting.tags.slice(0, 2).map((tag) => (
          <TagChip key={tag.id} name={tag.name} color={tag.color} />
        ))}
      </div>

      <div className="hidden w-28 shrink-0 text-right md:block">
        <div className="text-[13px] text-ink">{format(new Date(meeting.started_at), "h:mm a")}</div>
        <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink-subtle">
          <Clock className="size-3" aria-hidden />
          {formatDuration(meeting.duration_seconds)}
        </div>
      </div>

      <div className="hidden w-28 shrink-0 justify-end sm:flex">
        <AvatarStack names={meeting.participants.map((p) => p.name)} />
      </div>

      <div className="hidden w-14 shrink-0 justify-end sm:flex">
        {meeting.action_items_total > 0 && (
          <span
            title={allDone ? "All action items done" : `${meeting.action_items_open} open action items`}
            className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-ink-muted"
          >
            {allDone ? <CircleCheck className="size-3.5 text-success" /> : <ListChecks className="size-3.5" />}
            {allDone ? "Done" : meeting.action_items_open}
          </span>
        )}
      </div>

      <div className="relative z-10 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
        <MeetingRowActions meeting={meeting} />
      </div>
    </li>
  );
}
