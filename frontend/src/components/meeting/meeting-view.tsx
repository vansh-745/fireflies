"use client";

import { BarChart3, Bot, FileText, Highlighter, Search, Sparkles, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/tabs";
import { cn } from "@/lib/cn";
import { isTypingTarget } from "@/lib/hooks";
import { activeIndexAt, createPlayerStore, PlayerContext, type PlayerStore } from "@/lib/player";
import { usePreferences } from "@/lib/preferences";
import { useMeeting, useTranscript } from "@/lib/queries";
import type { MeetingDetail, Segment } from "@/lib/types";

import { AskFredPanel } from "./ask-fred";
import { matchesFilter, MeetingUIContext, type MeetingUI, type SidePanel, type TranscriptFilter } from "./meeting-context";
import { MeetingHeader } from "./meeting-header";
import { NotesPanel } from "./notes-panel";
import { PlayerBar } from "./player-bar";
import { HighlightsPanel, SmartSearchPanel, StatsPanel } from "./side-panels";
import { TranscriptPanel } from "./transcript-panel";

const PANELS: { id: SidePanel; label: string; icon: LucideIcon }[] = [
  { id: "search", label: "Smart Search", icon: Search },
  { id: "askfred", label: "AskFred", icon: Bot },
  { id: "highlights", label: "Soundbites & comments", icon: Highlighter },
  { id: "stats", label: "Speaker analytics", icon: BarChart3 },
];

export function MeetingView({ id }: { id: number }) {
  const meeting = useMeeting(id);
  const transcript = useTranscript(id);

  if (meeting.isError) {
    return (
      <EmptyState
        className="py-24"
        icon={<FileText />}
        title={meeting.error.message.includes("not found") ? "Meeting not found" : "Couldn't load this meeting"}
        description={meeting.error.message}
        action={
          <Link href="/meetings">
            <Button variant="primary">Back to meetings</Button>
          </Link>
        }
      />
    );
  }
  if (!meeting.data || !transcript.data) return <MeetingSkeleton />;
  return <LoadedMeeting key={id} meeting={meeting.data} segments={transcript.data} />;
}

function MeetingSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-var(--topbar-height))] flex-col">
      <div className="flex items-center gap-4 border-b border-border bg-surface px-5 py-4">
        <Skeleton className="size-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="flex flex-1 gap-px bg-border">
        {[0, 1].map((i) => (
          <div key={i} className="flex-1 space-y-3 bg-surface p-5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ))}
      </div>
    </div>
  );
}

function LoadedMeeting({ meeting, segments }: { meeting: MeetingDetail; segments: Segment[] }) {
  const params = useSearchParams();
  const [prefs] = usePreferences();
  const durationMs = Math.max(meeting.duration_seconds * 1000, segments.at(-1)?.end_ms ?? 0, 1000);
  // Deep link from search results: /meetings/1?t=45000&q=pricing
  const linkedMs = Number(params.get("t")) > 0 ? Number(params.get("t")) : null;

  // One player per meeting (the parent keys this component by meeting id).
  const [store] = useState<PlayerStore>(() => {
    const created = createPlayerStore(durationMs, prefs.playbackRate);
    if (linkedMs !== null) created.seek(linkedMs);
    return created;
  });
  useEffect(() => () => store.destroy(), [store]);

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<TranscriptFilter>(null);
  const [autoScroll, setAutoScroll] = useState(prefs.autoScroll);
  const [panel, setPanel] = useState<SidePanel | null>("search");
  const [mobileView, setMobileView] = useState<"notes" | "transcript">(linkedMs !== null ? "transcript" : "notes");
  const [jump, setJump] = useState<{ token: number; target: number | null }>({
    token: linkedMs !== null ? 1 : 0,
    target: linkedMs,
  });

  const starts = useMemo(() => segments.map((s) => s.start_ms), [segments]);
  const jumpTo = useCallback(
    (ms: number, options?: { play?: boolean }) => {
      store.seek(ms, options);
      setMobileView("transcript");
      setAutoScroll(true);
      // Drop a filter that would hide the moment we're jumping to.
      const target = segments[Math.max(0, activeIndexAt(starts, ms))];
      setFilter((current) => (target && !matchesFilter(current, target) ? null : current));
      setJump((j) => ({ token: j.token + 1, target: ms }));
    },
    [store, segments, starts],
  );

  // Space toggles playback; arrows skip (keyboard actions: no animation).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const role = (event.target as HTMLElement | null)?.getAttribute?.("role");
      if (event.key === " " && role !== "button" && (event.target as HTMLElement).tagName !== "BUTTON") {
        event.preventDefault();
        store.toggle();
      } else if (role !== "slider" && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
        store.skip(event.key === "ArrowRight" ? 5000 : -5000);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store]);

  const speakerSlots = useMemo(() => {
    const map = new Map<number, number>();
    meeting.participants.forEach((p, i) => map.set(p.id, (i % 8) + 1));
    return map;
  }, [meeting.participants]);

  const ui: MeetingUI = useMemo(
    () => ({
      meeting,
      segments,
      speakerSlots,
      search,
      setSearch,
      filter,
      setFilter,
      autoScroll,
      setAutoScroll,
      jumpTo,
      jumpToken: jump.token,
      jumpTarget: jump.target,
      openPanel: setPanel,
    }),
    [meeting, segments, speakerSlots, search, filter, autoScroll, jumpTo, jump],
  );

  const activePanel = PANELS.find((p) => p.id === panel);

  return (
    <PlayerContext.Provider value={store}>
      <MeetingUIContext.Provider value={ui}>
        {meeting.media_url && (
          <audio
            data-meeting-media
            src={meeting.media_url}
            preload="metadata"
            ref={(element) => {
              store.attachMedia(element);
              return () => store.attachMedia(null);
            }}
          />
        )}
        <div className="flex h-[calc(100dvh-var(--topbar-height))] flex-col">
          <MeetingHeader />

          <div className="flex items-center justify-center border-b border-border bg-surface py-2 lg:hidden">
            <Segmented
              value={mobileView}
              onChange={setMobileView}
              items={[
                { value: "notes", label: <><Sparkles className="size-3.5" /> AI Notes</> },
                { value: "transcript", label: <><FileText className="size-3.5" /> Transcript</> },
              ]}
            />
          </div>

          <div className="relative flex min-h-0 flex-1">
            {/* Icon rail */}
            <nav aria-label="Meeting tools" className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-surface py-3 md:flex">
              {PANELS.map(({ id, label, icon: Icon }) => (
                <IconButton key={id} label={label} tooltipSide="right" active={panel === id} onClick={() => setPanel(panel === id ? null : id)}>
                  <Icon className="size-[18px]" />
                </IconButton>
              ))}
            </nav>

            {activePanel && (
              <aside
                aria-label={activePanel.label}
                className={cn(
                  "hidden w-72 shrink-0 flex-col border-r border-border bg-surface md:flex",
                  // Overlay on narrower screens so notes + transcript keep their room.
                  "max-xl:absolute max-xl:inset-y-0 max-xl:left-14 max-xl:z-20 max-xl:shadow-elev-3",
                )}
              >
                <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
                  <h2 className="font-display text-sm font-semibold text-ink">{activePanel.label}</h2>
                  <IconButton label="Close panel" size="sm" tooltip={false} onClick={() => setPanel(null)}>
                    <X className="size-4" />
                  </IconButton>
                </div>
                <div className={cn("min-h-0 flex-1", panel === "askfred" ? "flex flex-col" : "overflow-y-auto")}>
                  {panel === "search" && <SmartSearchPanel />}
                  {panel === "askfred" && <AskFredPanel />}
                  {panel === "highlights" && <HighlightsPanel />}
                  {panel === "stats" && <StatsPanel />}
                </div>
              </aside>
            )}

            <div className={cn("min-w-0 flex-1 flex-col lg:flex", mobileView === "notes" ? "flex" : "hidden")}>
              <NotesPanel />
            </div>
            <div className={cn("min-w-0 flex-[1.15] flex-col lg:flex", mobileView === "transcript" ? "flex" : "hidden")}>
              <TranscriptPanel />
            </div>
          </div>

          <PlayerBar />
        </div>
      </MeetingUIContext.Provider>
    </PlayerContext.Provider>
  );
}
