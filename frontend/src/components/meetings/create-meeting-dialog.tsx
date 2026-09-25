"use client";

import { format } from "date-fns";
import { ClipboardPaste, FileText, FileUp, PencilLine, Sparkles, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChipInput } from "@/components/ui/chip-input";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { PLATFORM_LABELS } from "@/lib/format";
import { useCreateMeeting, usePeople, useTags, useUploadMeeting } from "@/lib/queries";
import { SAMPLE_TRANSCRIPT } from "@/lib/samples";
import type { MeetingDetail, Platform } from "@/lib/types";

export type CreateMode = "upload" | "paste" | "manual";

const TRANSCRIPT_EXTENSIONS = ["txt", "vtt", "srt", "json"];
const MEDIA_EXTENSIONS = ["mp3", "mp4", "m4a", "wav", "webm", "mov", "ogg", "aac", "flac"];
const MAX_BYTES = 2 * 1024 * 1024;

export function fileKind(file: File): "transcript" | "media" | "other" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (TRANSCRIPT_EXTENSIONS.includes(ext)) return "transcript";
  if (MEDIA_EXTENSIONS.includes(ext) || file.type.startsWith("audio/") || file.type.startsWith("video/")) return "media";
  return "other";
}

function titleFromFile(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Context so any page (top bar, library, uploads) can open the dialog ──────

interface OpenOptions {
  mode?: CreateMode;
  file?: File;
}

const CreateMeetingContext = createContext<(options?: OpenOptions) => void>(() => {});

export function useOpenCreateMeeting() {
  return useContext(CreateMeetingContext);
}

export function CreateMeetingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; options: OpenOptions; key: number }>({ open: false, options: {}, key: 0 });
  const open = useCallback((options: OpenOptions = {}) => setState((s) => ({ open: true, options, key: s.key + 1 })), []);
  return (
    <CreateMeetingContext.Provider value={open}>
      {children}
      <CreateMeetingDialog
        key={state.key}
        open={state.open}
        initial={state.options}
        onOpenChange={(value) => setState((s) => ({ ...s, open: value }))}
      />
    </CreateMeetingContext.Provider>
  );
}

// ── Dialog ────────────────────────────────────────────────────────────────

function CreateMeetingDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: OpenOptions;
}) {
  const router = useRouter();
  const createMeeting = useCreateMeeting();
  const uploadMeeting = useUploadMeeting();
  const { data: people = [] } = usePeople();
  const { data: tags = [] } = useTags();

  const initialFile = initial.file && fileKind(initial.file) === "transcript" ? initial.file : null;
  const [mode, setMode] = useState<CreateMode>(initial.mode ?? (initial.file ? "upload" : "upload"));
  const [file, setFile] = useState<File | null>(initialFile);
  const [fileError, setFileError] = useState<string | null>(
    initial.file && !initialFile ? mediaMessage(initial.file) : null,
  );
  const [title, setTitle] = useState(initialFile ? titleFromFile(initialFile.name) : "");
  const [startedAt, setStartedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [participants, setParticipants] = useState<string[]>([]);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [platform, setPlatform] = useState<Platform>("upload");
  const [transcript, setTranscript] = useState("");
  const [durationMin, setDurationMin] = useState("30");
  const [dragging, setDragging] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const busy = createMeeting.isPending || uploadMeeting.isPending;
  const peopleNames = useMemo(() => people.map((p) => p.name), [people]);
  const tagSuggestions = useMemo(() => tags.map((t) => t.name), [tags]);

  function mediaMessage(f: File) {
    return fileKind(f) === "media"
      ? `“${f.name}” is an audio/video file. Speech-to-text is coming soon — upload a transcript (.txt, .vtt, .srt or .json) instead.`
      : `“${f.name}” isn't a supported transcript. Use .txt, .vtt, .srt or .json.`;
  }

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (fileKind(f) !== "transcript") {
      setFile(null);
      setFileError(mediaMessage(f));
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setFileError("Transcript files must be 2 MB or smaller.");
      return;
    }
    setFileError(null);
    setFile(f);
    if (!title.trim()) setTitle(titleFromFile(f.name));
  };

  const finish = (meeting: MeetingDetail) => {
    toast.success("Meeting created", {
      description:
        meeting.summary?.status === "processing"
          ? "Fred is writing the AI notes — they'll appear in a moment."
          : meeting.summary
            ? "Transcript and AI notes are ready."
            : "Add a transcript later or start taking notes.",
    });
    onOpenChange(false);
    router.push(`/meetings/${meeting.id}`);
  };

  const submit = () => {
    if (!title.trim() && !(mode === "upload" && file)) {
      setTitleError("Give the meeting a title.");
      return;
    }
    setTitleError(null);
    const started = new Date(startedAt).toISOString();

    if (mode === "upload") {
      if (!file) {
        setFileError("Choose a transcript file to upload.");
        return;
      }
      const form = new FormData();
      form.set("file", file);
      if (title.trim()) form.set("title", title.trim());
      form.set("started_at", started);
      if (participants.length) form.set("participants", participants.join(","));
      if (tagNames.length) form.set("tags", tagNames.join(","));
      uploadMeeting.mutate(form, { onSuccess: finish });
      return;
    }

    if (mode === "paste" && !transcript.trim()) {
      toast.error("Paste a transcript first, or switch to manual entry.");
      return;
    }
    createMeeting.mutate(
      {
        title: title.trim(),
        started_at: started,
        platform: mode === "manual" ? platform : "upload",
        participants: participants.map((name) => ({ name })),
        tags: tagNames,
        transcript_text: mode === "paste" ? transcript : undefined,
        duration_seconds: mode === "manual" ? Math.max(0, Math.round(Number(durationMin) * 60) || 0) : undefined,
      },
      { onSuccess: finish },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title="New meeting"
      description="Upload or paste a transcript and Fred will write the notes, or create an empty meeting."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit} icon={<Sparkles className="size-4" />}>
            {mode === "manual" ? "Create meeting" : "Create & transcribe"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Segmented<CreateMode>
          value={mode}
          onChange={setMode}
          items={[
            { value: "upload", label: <><FileUp className="size-3.5" /> Upload file</> },
            { value: "paste", label: <><ClipboardPaste className="size-3.5" /> Paste transcript</> },
            { value: "manual", label: <><PencilLine className="size-3.5" /> Manual entry</> },
          ]}
        />

        {mode === "upload" && (
          <div>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                pickFile(event.dataTransfer.files[0]);
              }}
              className={cn(
                "flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center",
                "transition-colors duration-(--duration-press) ease-(--ease-hover)",
                dragging ? "border-accent bg-accent-subtle" : "border-border hover:border-accent hover:bg-surface-raised",
              )}
            >
              {file ? (
                <>
                  <FileText className="size-8 text-accent" aria-hidden />
                  <span className="mt-2 text-sm font-medium text-ink">{file.name}</span>
                  <span className="text-xs text-ink-muted">{(file.size / 1024).toFixed(1)} KB · click to replace</span>
                </>
              ) : (
                <>
                  <UploadCloud className="size-8 text-accent" aria-hidden />
                  <span className="mt-2 text-sm font-medium text-ink">Drop a transcript here or click to browse</span>
                  <span className="text-xs text-ink-muted">.txt, .vtt, .srt or .json — up to 2 MB</span>
                </>
              )}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".txt,.vtt,.srt,.json,audio/*,video/*"
              className="sr-only"
              onChange={(event) => pickFile(event.target.files?.[0])}
            />
            {fileError && (
              <p role="alert" className="mt-2 text-xs text-danger">
                {fileError}
              </p>
            )}
          </div>
        )}

        {mode === "paste" && (
          <Field
            label="Transcript"
            hint={
              <>
                One line per utterance: <code className="font-mono">Speaker: text</code>, optionally with a{" "}
                <code className="font-mono">[00:01:23]</code> timestamp.{" "}
                <button type="button" className="font-medium text-accent-ink hover:underline" onClick={() => {
                  setTranscript(SAMPLE_TRANSCRIPT);
                  if (!title.trim()) setTitle("Pricing Page Review");
                }}>
                  Try a sample
                </button>
              </>
            }
          >
            {(id) => (
              <Textarea
                id={id}
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                placeholder={"[00:00:05] Jane Doe: Thanks for joining…\n[00:00:12] John Smith: Happy to be here."}
                className="min-h-44 font-mono text-[13px]"
              />
            )}
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title" error={titleError} className="sm:col-span-2" hint={mode === "upload" ? "Defaults to the file name." : undefined}>
            {(id) => <Input id={id} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Weekly sync" />}
          </Field>
          <Field label="Date & time">
            {(id) => <Input id={id} type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />}
          </Field>
          {mode === "manual" ? (
            <Field label="Duration (minutes)">
              {(id) => (
                <Input id={id} type="number" min={0} max={1440} value={durationMin} onChange={(event) => setDurationMin(event.target.value)} />
              )}
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          {mode === "manual" && (
            <Field label="Platform" className="sm:col-span-2">
              {(id) => (
                <select
                  id={id}
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as Platform)}
                  className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-ink hover:border-border-strong focus:border-accent focus:outline-none"
                >
                  {Object.entries(PLATFORM_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Participants" className="sm:col-span-2" hint={mode === "manual" ? undefined : "Speakers found in the transcript are added automatically."}>
            {(id) => (
              <ChipInput id={id} values={participants} onChange={setParticipants} suggestions={peopleNames} placeholder="Add a name and press Enter" />
            )}
          </Field>
          <Field label="Tags" className="sm:col-span-2">
            {(id) => <ChipInput id={id} values={tagNames} onChange={setTagNames} suggestions={tagSuggestions} placeholder="e.g. Sales, Planning" />}
          </Field>
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
