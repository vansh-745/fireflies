"use client";

import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from "lucide-react";
import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

import { IconButton } from "@/components/ui/button";
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { formatTimestamp } from "@/lib/format";
import { PLAYBACK_RATES, usePlayer, usePlayerStore } from "@/lib/player";
import { usePreferences } from "@/lib/preferences";

import { slotFor, useMeetingUI } from "./meeting-context";

function SeekBar() {
  const ui = useMeetingUI();
  const store = usePlayerStore();
  const durationMs = usePlayer((s) => s.durationMs);
  const currentMs = usePlayer((s) => s.currentMs);
  const trackRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ x: number; ms: number } | null>(null);
  const dragging = useRef(false);

  const progress = Math.min(1, currentMs / durationMs);

  const msAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return { ms: ratio * durationMs, x: ratio * rect.width };
  };

  const chapterAt = (ms: number) => [...ui.meeting.chapters].reverse().find((c) => c.start_ms <= ms);

  // Speaker blocks: merge consecutive segments by the same speaker to keep the DOM small.
  const blocks = useMemo(() => {
    const merged: { start: number; end: number; slot: number }[] = [];
    for (const seg of ui.segments) {
      const slot = slotFor(ui, seg.speaker?.participant_id);
      const last = merged.at(-1);
      if (last && last.slot === slot && seg.start_ms - last.end < 2000) last.end = seg.end_ms;
      else merged.push({ start: seg.start_ms, end: seg.end_ms, slot });
    }
    return merged;
  }, [ui]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    store.seek(msAt(event.clientX).ms);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const at = msAt(event.clientX);
    setHover(at);
    if (dragging.current) store.seek(at.ms);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30_000 : 5_000;
    if (event.key === "ArrowRight") store.skip(step);
    else if (event.key === "ArrowLeft") store.skip(-step);
    else if (event.key === "Home") store.seek(0);
    else if (event.key === "End") store.seek(durationMs);
    else return;
    event.preventDefault();
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(durationMs / 1000)}
      aria-valuenow={Math.round(currentMs / 1000)}
      aria-valuetext={`${formatTimestamp(currentMs)} of ${formatTimestamp(durationMs)}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => (dragging.current = false)}
      onPointerLeave={() => setHover(null)}
      onKeyDown={onKeyDown}
      className="group relative h-8 flex-1 cursor-pointer touch-none rounded focus-visible:outline-offset-4"
    >
      {/* Speaker timeline */}
      <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-sunken">
        {blocks.map((block, i) => (
          <span
            key={i}
            className="absolute inset-y-0 opacity-45"
            style={{
              left: `${(block.start / durationMs) * 100}%`,
              width: `${Math.max(0.2, ((block.end - block.start) / durationMs) * 100)}%`,
              background: `var(--speaker-${block.slot})`,
            }}
          />
        ))}
        {/* Played portion: scaleX instead of width so it stays on the compositor. */}
        <span
          className="absolute inset-0 origin-left bg-accent/35"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      {/* Chapter markers */}
      {ui.meeting.chapters.map((chapter) => (
        <span
          key={chapter.id}
          aria-hidden
          className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-ink-subtle/60"
          style={{ left: `${(chapter.start_ms / durationMs) * 100}%` }}
        />
      ))}

      {/* Playhead */}
      <span className="pointer-events-none absolute inset-y-0 left-0 w-full" style={{ transform: `translateX(${progress * 100}%)` }}>
        <span className="absolute top-1/2 -left-[7px] size-3.5 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-elev-2" />
      </span>

      {hover && (
        <span
          className="pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-md bg-surface-inverse px-2 py-1 text-xs whitespace-nowrap text-ink-inverse shadow-elev-2"
          style={{ left: hover.x }}
        >
          <span className="font-mono tabular-nums">{formatTimestamp(hover.ms)}</span>
          {chapterAt(hover.ms) && <span className="ml-1.5 opacity-80">· {chapterAt(hover.ms)!.title}</span>}
        </span>
      )}
    </div>
  );
}

export function PlayerBar() {
  const store = usePlayerStore();
  const playing = usePlayer((s) => s.playing);
  const rate = usePlayer((s) => s.rate);
  const hasMedia = usePlayer((s) => s.hasMedia);
  const currentMs = usePlayer((s) => Math.floor(s.currentMs / 1000) * 1000);
  const durationMs = usePlayer((s) => s.durationMs);
  const [, setPrefs] = usePreferences();
  const [muted, setMuted] = useState(false);

  return (
    <div className="flex h-(--player-height) shrink-0 items-center gap-3 border-t border-border bg-surface px-3 sm:gap-4 sm:px-5">
      <div className="flex items-center gap-1">
        <IconButton label="Back 15 seconds" tooltipSide="top" onClick={() => store.skip(-15_000)}>
          <RotateCcw className="size-[18px]" />
        </IconButton>
        <Tooltip content={playing ? "Pause (Space)" : "Play (Space)"}>
          <button
            type="button"
            onClick={() => store.toggle()}
            aria-label={playing ? "Pause" : "Play"}
            className="pressable inline-flex size-10 items-center justify-center rounded-full bg-accent text-on-accent shadow-elev-2 hover:bg-accent-hover"
          >
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
          </button>
        </Tooltip>
        <IconButton label="Forward 15 seconds" tooltipSide="top" onClick={() => store.skip(15_000)}>
          <RotateCw className="size-[18px]" />
        </IconButton>
      </div>

      <span className="hidden w-24 shrink-0 font-mono text-xs text-ink-muted tabular-nums sm:block">
        {formatTimestamp(currentMs)} / {formatTimestamp(durationMs)}
      </span>

      <SeekBar />

      <Menu
        side="top"
        trigger={
          <button
            type="button"
            aria-label={`Playback speed ${rate}x`}
            className="pressable h-8 min-w-12 rounded-md border border-border px-2 font-mono text-xs font-semibold text-ink hover:bg-surface-sunken"
          >
            {rate}x
          </button>
        }
        className="min-w-32"
      >
        <MenuLabel>Speed</MenuLabel>
        {PLAYBACK_RATES.map((option) => (
          <MenuItem
            key={option}
            onSelect={() => {
              store.setRate(option);
              setPrefs({ playbackRate: option });
            }}
            hint={option === rate ? "✓" : undefined}
          >
            {option}x
          </MenuItem>
        ))}
      </Menu>

      <IconButton
        label={hasMedia ? (muted ? "Unmute" : "Mute") : "Simulated playback — add a recording URL to hear audio"}
        tooltipSide="top"
        className={cn("hidden sm:inline-flex", !hasMedia && "opacity-60")}
        onClick={() => {
          const media = document.querySelector<HTMLMediaElement>("[data-meeting-media]");
          if (media) {
            media.muted = !media.muted;
            setMuted(media.muted);
          }
        }}
      >
        {muted || !hasMedia ? <VolumeX className="size-[18px]" /> : <Volume2 className="size-[18px]" />}
      </IconButton>
    </div>
  );
}
