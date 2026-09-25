"use client";

import { Bot, Link2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ComingSoonBadge } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/field";

/** "Add to live meeting" — the real-time bot is out of scope, so this is a styled placeholder. */
export function CaptureDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [link, setLink] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      title={
        <span className="flex items-center gap-2">
          Add Fred to a live meeting <ComingSoonBadge />
        </span>
      }
      description="Fred joins your Zoom, Google Meet or Teams call and transcribes it in real time."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            icon={<Bot className="size-4" />}
            onClick={() => {
              toast("The live meeting bot is coming soon", {
                description: "For now, upload or paste a transcript to get AI notes.",
              });
              onOpenChange(false);
            }}
          >
            Invite Fred
          </Button>
        </>
      }
    >
      <Field label="Meeting link" hint="Paste a Zoom, Google Meet or Microsoft Teams link.">
        {(id) => (
          <Input
            id={id}
            icon={<Link2 />}
            value={link}
            onChange={(event) => setLink(event.target.value)}
            placeholder="https://meet.google.com/abc-defg-hij"
          />
        )}
      </Field>
    </Dialog>
  );
}
