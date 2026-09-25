"use client";

import { format } from "date-fns";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ChipInput } from "@/components/ui/chip-input";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { PLATFORM_LABELS } from "@/lib/format";
import { usePeople, useTags, useUpdateMeeting } from "@/lib/queries";
import type { MeetingDetail, MeetingListItem, Platform } from "@/lib/types";

/** Edit title, date, platform, participants, tags and recording URL. */
export function EditMeetingDialog({
  meeting,
  speakerIds = [],
  open,
  onOpenChange,
}: {
  meeting: MeetingListItem | MeetingDetail;
  /** Participant ids that speak in the transcript; they can't be removed. */
  speakerIds?: number[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useUpdateMeeting(meeting.id);
  const { data: people = [] } = usePeople();
  const { data: tags = [] } = useTags();

  const [title, setTitle] = useState(meeting.title);
  const [startedAt, setStartedAt] = useState(format(new Date(meeting.started_at), "yyyy-MM-dd'T'HH:mm"));
  const [platform, setPlatform] = useState<Platform>(meeting.platform);
  const [participants, setParticipants] = useState(meeting.participants.map((p) => p.name));
  const [tagNames, setTagNames] = useState(meeting.tags.map((t) => t.name));
  const [mediaUrl, setMediaUrl] = useState("media_url" in meeting ? (meeting.media_url ?? "") : "");
  const [titleError, setTitleError] = useState<string | null>(null);

  const locked = useMemo(
    () => meeting.participants.filter((p) => speakerIds.includes(p.id)).map((p) => p.name),
    [meeting.participants, speakerIds],
  );

  const save = () => {
    if (!title.trim()) {
      setTitleError("Title can't be empty.");
      return;
    }
    const known = new Map(meeting.participants.map((p) => [p.name.toLowerCase(), p]));
    const hasHost = participants.some((name) => known.get(name.toLowerCase())?.role === "host");
    update.mutate(
      {
        title: title.trim(),
        started_at: new Date(startedAt).toISOString(),
        platform,
        tags: tagNames,
        participants: participants.map((name, index) => {
          const existing = known.get(name.toLowerCase());
          return {
            name,
            email: existing?.email ?? null,
            role: existing?.role === "host" || (!hasHost && index === 0) ? "host" : "attendee",
          };
        }),
        ...("media_url" in meeting ? { media_url: mediaUrl.trim() || null } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Meeting updated");
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit meeting details"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={update.isPending} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <Field label="Title" error={titleError} className="sm:col-span-2">
          {(id) => <Input id={id} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />}
        </Field>
        <Field label="Date & time">
          {(id) => <Input id={id} type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} />}
        </Field>
        <Field label="Platform">
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
        <Field
          label="Participants"
          className="sm:col-span-2"
          hint={locked.length ? "People who speak in the transcript can't be removed." : undefined}
        >
          {(id) => (
            <ChipInput
              id={id}
              values={participants}
              onChange={setParticipants}
              lockedValues={locked}
              suggestions={people.map((p) => p.name)}
              placeholder="Add a name and press Enter"
              renderChip={(name) => (
                <span className="inline-flex items-center gap-1">
                  {locked.includes(name) && <Lock className="size-3 text-ink-subtle" aria-label="Speaker" />}
                  {name}
                </span>
              )}
            />
          )}
        </Field>
        <Field label="Tags" className="sm:col-span-2">
          {(id) => <ChipInput id={id} values={tagNames} onChange={setTagNames} suggestions={tags.map((t) => t.name)} placeholder="Add a tag" />}
        </Field>
        {"media_url" in meeting && (
          <Field label="Recording URL" className="sm:col-span-2" hint="Optional link to an audio/video file. Without one, playback is simulated.">
            {(id) => (
              <Input id={id} type="url" value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="https://…/recording.mp3" />
            )}
          </Field>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Dialog>
  );
}
