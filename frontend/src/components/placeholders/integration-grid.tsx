"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, ComingSoonBadge } from "@/components/ui/feedback";
import { speakerStyle } from "@/lib/colors";

const GROUPS = [
  {
    title: "Meeting platforms",
    items: [
      { name: "Zoom", description: "Auto-join and record Zoom meetings.", slot: 5 },
      { name: "Google Meet", description: "Capture Meet calls from your calendar.", slot: 3 },
      { name: "Microsoft Teams", description: "Transcribe Teams meetings.", slot: 6 },
    ],
  },
  {
    title: "Calendar",
    items: [
      { name: "Google Calendar", description: "Fred joins meetings on your calendar.", slot: 5 },
      { name: "Outlook Calendar", description: "Sync events from Microsoft 365.", slot: 5 },
    ],
  },
  {
    title: "CRM & productivity",
    items: [
      { name: "Salesforce", description: "Log notes and action items to records.", slot: 5 },
      { name: "HubSpot", description: "Sync call summaries to deals.", slot: 8 },
      { name: "Slack", description: "Post meeting recaps to channels.", slot: 2 },
      { name: "Notion", description: "Send notes to a Notion database.", slot: 1 },
    ],
  },
];

export function IntegrationGrid() {
  return (
    <div className="mt-8 flex flex-col gap-8">
      {GROUPS.map((group) => (
        <section key={group.title}>
          <h2 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">{group.title}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => (
              <li key={item.name}>
                <Card className="flex h-full flex-col p-4">
                  <div className="flex items-center gap-3">
                    <span
                      style={speakerStyle(item.slot)}
                      className="flex size-10 items-center justify-center rounded-lg bg-(--chip-bg) font-display text-base font-bold text-(--chip-ink)"
                      aria-hidden
                    >
                      {item.name[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-ink">{item.name}</div>
                      <ComingSoonBadge />
                    </div>
                  </div>
                  <p className="mt-3 flex-1 text-sm text-ink-muted">{item.description}</p>
                  <Button size="sm" className="mt-4 self-start" onClick={() => toast(`${item.name} integration is coming soon`)}>
                    Connect
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
