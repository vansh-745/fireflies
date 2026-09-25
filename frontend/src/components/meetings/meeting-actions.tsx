"use client";

import { Download, Ellipsis, ExternalLink, Link2, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Menu, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { api } from "@/lib/api";
import { useDeleteMeeting } from "@/lib/queries";
import type { MeetingListItem } from "@/lib/types";

import { EditMeetingDialog } from "./edit-meeting-dialog";

export function downloadUrl(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function useDeleteMeetingFlow(meeting: { id: number; title: string }, afterDelete?: () => void) {
  const [open, setOpen] = useState(false);
  const remove = useDeleteMeeting();
  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={setOpen}
      title="Delete this meeting?"
      description={
        <>
          <span className="font-medium text-ink">“{meeting.title}”</span> and its transcript, notes, action items,
          comments and soundbites will be permanently deleted.
        </>
      }
      confirmLabel="Delete meeting"
      loading={remove.isPending}
      onConfirm={() =>
        remove.mutate(meeting.id, {
          onSuccess: () => {
            setOpen(false);
            toast.success("Meeting deleted");
            afterDelete?.();
          },
        })
      }
    />
  );
  return { open: () => setOpen(true), dialog };
}

/** Row-level "⋯" menu in the meetings library. */
export function MeetingRowActions({ meeting }: { meeting: MeetingListItem }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const deletion = useDeleteMeetingFlow(meeting);

  return (
    <>
      <Menu
        trigger={
          <IconButton label="Meeting actions" size="sm" tooltip={false} onClick={(event) => event.stopPropagation()}>
            <Ellipsis className="size-4" />
          </IconButton>
        }
      >
        <MenuItem icon={<ExternalLink />} onSelect={() => router.push(`/meetings/${meeting.id}`)}>
          Open meeting
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={() => setEditing(true)}>
          Edit details
        </MenuItem>
        <MenuItem
          icon={<Link2 />}
          onSelect={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}/meetings/${meeting.id}`);
            toast.success("Link copied");
          }}
        >
          Copy link
        </MenuItem>
        <MenuItem icon={<Download />} onSelect={() => downloadUrl(api.exportUrl(meeting.id, "md"))}>
          Download notes
        </MenuItem>
        <MenuSeparator />
        <MenuItem icon={<Trash2 />} destructive onSelect={deletion.open}>
          Delete
        </MenuItem>
      </Menu>
      {editing && <EditMeetingDialog meeting={meeting} open={editing} onOpenChange={setEditing} />}
      {deletion.dialog}
    </>
  );
}
