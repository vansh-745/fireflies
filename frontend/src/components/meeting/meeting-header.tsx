"use client";

import { ArrowLeft, CalendarDays, Clock, Download, Ellipsis, FileText, Pencil, RefreshCw, Share2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EditMeetingDialog } from "@/components/meetings/edit-meeting-dialog";
import { downloadUrl, useDeleteMeetingFlow } from "@/components/meetings/meeting-actions";
import { PlatformIcon } from "@/components/meetings/platform-icon";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Button, IconButton } from "@/components/ui/button";
import { TagChip } from "@/components/ui/chip";
import { Menu, MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/menu";
import { api } from "@/lib/api";
import { formatDuration, formatLongDate, PLATFORM_LABELS } from "@/lib/format";
import { useRegenerateSummary } from "@/lib/queries";
import type { ExportContent, ExportFormat } from "@/lib/types";

import { slotFor, useMeetingUI } from "./meeting-context";

const EXPORTS: { label: string; format: ExportFormat; content: ExportContent }[] = [
  { label: "Notes + transcript (PDF)", format: "pdf", content: "full" },
  { label: "Notes + transcript (Markdown)", format: "md", content: "full" },
  { label: "AI notes only (PDF)", format: "pdf", content: "summary" },
  { label: "AI notes only (Markdown)", format: "md", content: "summary" },
  { label: "Transcript (TXT)", format: "txt", content: "transcript" },
  { label: "Transcript captions (SRT)", format: "srt", content: "transcript" },
];

export function MeetingHeader() {
  const ui = useMeetingUI();
  const { meeting } = ui;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const regenerate = useRegenerateSummary(meeting.id);
  const deletion = useDeleteMeetingFlow(meeting, () => router.push("/meetings"));
  const speakerIds = meeting.speaker_stats.map((s) => s.participant_id).filter((id): id is number => id !== null);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border bg-surface px-4 py-3 sm:px-5">
      <IconButton label="Back to meetings" onClick={() => router.push("/meetings")}>
        <ArrowLeft className="size-[18px]" />
      </IconButton>
      <PlatformIcon platform={meeting.platform} />
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-lg font-semibold text-ink">{meeting.title}</h1>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5" aria-hidden />
            {formatLongDate(meeting.started_at)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatDuration(meeting.duration_seconds)}
          </span>
          <span>{PLATFORM_LABELS[meeting.platform]}</span>
          {meeting.tags.map((tag) => (
            <Link key={tag.id} href={`/meetings?tag=${tag.id}`}>
              <TagChip name={tag.name} color={tag.color} />
            </Link>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Popover
          align="end"
          className="w-72"
          trigger={
            <button type="button" className="pressable rounded-full p-0.5 hover:bg-surface-sunken" aria-label={`${meeting.participants.length} participants`}>
              <AvatarStack names={meeting.participants.map((p) => p.name)} max={4} />
            </button>
          }
        >
          <div className="border-b border-border px-4 py-3 text-sm font-semibold text-ink">
            Participants · {meeting.participants.length}
          </div>
          <ul className="max-h-80 overflow-y-auto p-1">
            {meeting.participants.map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 rounded-md px-3 py-2">
                <Avatar name={p.name} slot={slotFor(ui, p.id)} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-ink">{p.name}</div>
                  {p.email && <div className="truncate text-xs text-ink-subtle">{p.email}</div>}
                </div>
                {p.role === "host" && <span className="rounded bg-accent-subtle px-1.5 text-xxs font-semibold text-accent-ink">Host</span>}
              </li>
            ))}
          </ul>
          <div className="border-t border-border p-2">
            <Button size="sm" variant="ghost" className="w-full" icon={<Pencil className="size-3.5" />} onClick={() => setEditing(true)}>
              Edit participants
            </Button>
          </div>
        </Popover>

        <Button
          size="sm"
          icon={<Share2 className="size-4" />}
          className="max-sm:hidden"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href);
            toast.success("Link copied", { description: "Team sharing and permissions are coming soon." });
          }}
        >
          Share
        </Button>

        <Menu
          trigger={
            <Button size="sm" variant="primary" icon={<Download className="size-4" />}>
              <span className="hidden sm:inline">Download</span>
            </Button>
          }
        >
          <MenuLabel>Export</MenuLabel>
          {EXPORTS.map((option) => (
            <MenuItem
              key={option.label}
              icon={<FileText />}
              onSelect={() => {
                downloadUrl(api.exportUrl(meeting.id, option.format, option.content));
                toast.success("Download started");
              }}
            >
              {option.label}
            </MenuItem>
          ))}
        </Menu>

        <Menu
          trigger={
            <IconButton label="More actions" tooltip={false}>
              <Ellipsis className="size-[18px]" />
            </IconButton>
          }
        >
          <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
            Edit details
          </MenuItem>
          {meeting.segment_count > 0 && (
            <MenuItem
              icon={<RefreshCw />}
              disabled={regenerate.isPending || meeting.summary?.status === "processing"}
              onSelect={() => regenerate.mutate(undefined, { onSuccess: () => toast.success("AI notes regenerated") })}
            >
              Regenerate AI notes
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuItem icon={<Trash2 />} destructive onSelect={deletion.open}>
            Delete meeting
          </MenuItem>
        </Menu>
      </div>

      {editing && <EditMeetingDialog meeting={meeting} speakerIds={speakerIds} open={editing} onOpenChange={setEditing} />}
      {deletion.dialog}
    </header>
  );
}
