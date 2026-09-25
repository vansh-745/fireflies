"use client";

import { AudioLines, ClipboardPaste, Download, FileText, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { fileKind, useOpenCreateMeeting } from "@/components/meetings/create-meeting-dialog";
import { PlatformIcon } from "@/components/meetings/platform-icon";
import { Button } from "@/components/ui/button";
import { Card, ComingSoonBadge, EmptyState, Skeleton } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { formatDuration, formatMeetingDate } from "@/lib/format";
import { useMeetings } from "@/lib/queries";

const SAMPLES = [
  { file: "product-sync.txt", label: "Plain text", hint: "Speaker: text, with timestamps" },
  { file: "customer-call.vtt", label: "WebVTT", hint: "Zoom / Meet caption export" },
  { file: "design-crit.srt", label: "SRT", hint: "Subtitle file with speakers" },
  { file: "hiring-sync.json", label: "JSON", hint: "[{speaker, text, start, end}]" },
];

export function UploadsView() {
  const openCreate = useOpenCreateMeeting();
  const [dragging, setDragging] = useState(false);
  // Recent uploads = meetings created from files or pasted text (newest first).
  const { data, isLoading } = useMeetings({ sort: "newest" });
  const uploads = (data?.pages.flatMap((p) => p.items) ?? []).filter((m) => m.source === "upload" || m.source === "paste");

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (fileKind(file) === "media") {
      toast("Speech-to-text is coming soon", {
        description: `“${file.name}” is audio/video. Upload its transcript (.txt, .vtt, .srt or .json) instead.`,
      });
      return;
    }
    openCreate({ mode: "upload", file });
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <h1 className="font-display text-2xl font-semibold text-ink">Uploads</h1>
      <p className="mt-1 text-sm text-ink-muted">Bring in transcripts from any tool. Fred writes the summary, outline and action items.</p>

      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFile(event.dataTransfer.files[0]);
        }}
        className={cn(
          "mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center",
          "transition-colors duration-(--duration-press) ease-(--ease-hover)",
          dragging ? "border-accent bg-accent-subtle" : "border-border bg-surface hover:border-accent",
        )}
      >
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-subtle text-accent-ink">
          <UploadCloud className="size-7" aria-hidden />
        </span>
        <span className="mt-4 font-display text-lg font-semibold text-ink">Drag & drop a transcript</span>
        <span className="mt-1 text-sm text-ink-muted">or click to browse · .txt, .vtt, .srt, .json up to 2 MB</span>
        <input type="file" className="sr-only" accept=".txt,.vtt,.srt,.json,audio/*,video/*" onChange={(event) => handleFile(event.target.files?.[0])} />
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-surface-sunken px-3 py-1 text-xs text-ink-muted">
          <AudioLines className="size-3.5" /> Audio & video transcription <ComingSoonBadge />
        </span>
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button icon={<ClipboardPaste className="size-4" />} onClick={() => openCreate({ mode: "paste" })}>
          Paste a transcript instead
        </Button>
      </div>

      <h2 className="mt-10 font-display text-base font-semibold text-ink">Sample files</h2>
      <p className="mt-1 text-sm text-ink-muted">Download one and drop it above to try the upload flow.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {SAMPLES.map((sample) => (
          <a
            key={sample.file}
            href={`/samples/${sample.file}`}
            download
            className="pressable flex items-center gap-3 rounded-xl border border-border bg-surface p-3 hover:border-accent"
          >
            <FileText className="size-5 shrink-0 text-accent" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-ink">{sample.label}</span>
              <span className="block truncate text-xs text-ink-subtle">{sample.hint}</span>
            </span>
            <Download className="size-4 shrink-0 text-ink-subtle" aria-hidden />
          </a>
        ))}
      </div>

      <h2 className="mt-10 font-display text-base font-semibold text-ink">Recent uploads</h2>
      <Card className="mt-3 overflow-hidden">
        {isLoading ? (
          <div className="space-y-3 p-5">{[0, 1].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : uploads.length === 0 ? (
          <EmptyState icon={<FileText />} title="No uploads yet" description="Transcripts you upload or paste show up here." />
        ) : (
          <ul className="divide-y divide-border">
            {uploads.map((meeting) => (
              <li key={meeting.id} className="relative flex items-center gap-3 px-5 py-3 hover:bg-surface-raised">
                <PlatformIcon platform={meeting.platform} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/meetings/${meeting.id}`} className="block truncate text-sm font-medium text-ink after:absolute after:inset-0">
                    {meeting.title}
                  </Link>
                  <div className="text-xs text-ink-subtle">
                    {meeting.source === "upload" ? "Uploaded file" : "Pasted text"} · {formatMeetingDate(meeting.created_at)} · {formatDuration(meeting.duration_seconds)}
                  </div>
                </div>
                <span className="rounded-full bg-success-subtle px-2 py-0.5 text-xxs font-semibold text-success">Ready</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
