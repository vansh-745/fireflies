"use client";

import { createContext, useContext } from "react";

import type { MeetingDetail, Segment, SegmentFlag } from "@/lib/types";

export type TranscriptFilter = { kind: "flag"; flag: SegmentFlag } | { kind: "speaker"; participantId: number; name: string } | null;

export type SidePanel = "search" | "askfred" | "highlights" | "stats";

export interface MeetingUI {
  meeting: MeetingDetail;
  segments: Segment[];
  /** Participant id → colour slot (1–8), stable within the meeting. */
  speakerSlots: Map<number, number>;
  search: string;
  setSearch: (value: string) => void;
  filter: TranscriptFilter;
  setFilter: (filter: TranscriptFilter) => void;
  /** Transcript follows the playhead while playing. */
  autoScroll: boolean;
  setAutoScroll: (value: boolean) => void;
  /** Seek the player and bring that moment into view in the transcript. */
  jumpTo: (ms: number, options?: { play?: boolean }) => void;
  /** Incremented on every jumpTo so the transcript can react even to the same time. */
  jumpToken: number;
  jumpTarget: number | null;
  openPanel: (panel: SidePanel) => void;
}

export const MeetingUIContext = createContext<MeetingUI | null>(null);

export function useMeetingUI(): MeetingUI {
  const value = useContext(MeetingUIContext);
  if (!value) throw new Error("useMeetingUI must be used inside the meeting page");
  return value;
}

export function matchesFilter(filter: TranscriptFilter, segment: Segment): boolean {
  if (!filter) return true;
  if (filter.kind === "flag") return segment.flags.includes(filter.flag);
  return segment.speaker?.participant_id === filter.participantId;
}

export function slotFor(ui: Pick<MeetingUI, "speakerSlots">, participantId: number | null | undefined): number {
  return participantId != null ? (ui.speakerSlots.get(participantId) ?? 1) : 8;
}
