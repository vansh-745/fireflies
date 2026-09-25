"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * Playback clock for a meeting. When the meeting has a recording URL it drives
 * an <audio> element; otherwise it runs a simulated clock so the transcript,
 * outline and seek bar behave exactly as they would with real media.
 *
 * State lives outside React (useSyncExternalStore) so a 60fps clock only
 * re-renders the components that select the value that changed.
 */
export interface PlayerState {
  currentMs: number;
  durationMs: number;
  playing: boolean;
  rate: number;
  /** Stop automatically here (used by soundbite playback). */
  stopAtMs: number | null;
  hasMedia: boolean;
}

export const PLAYBACK_RATES = [1, 1.25, 1.5, 1.75, 2] as const;

export interface PlayerStore {
  getState(): PlayerState;
  subscribe(listener: () => void): () => void;
  play(): void;
  pause(): void;
  toggle(): void;
  seek(ms: number, options?: { play?: boolean }): void;
  skip(deltaMs: number): void;
  setRate(rate: number): void;
  playRange(startMs: number, endMs: number): void;
  attachMedia(element: HTMLMediaElement | null): void;
  destroy(): void;
}

export function createPlayerStore(durationMs: number, initialRate = 1): PlayerStore {
  let state: PlayerState = {
    currentMs: 0,
    durationMs: Math.max(durationMs, 1),
    playing: false,
    rate: initialRate,
    stopAtMs: null,
    hasMedia: false,
  };
  const listeners = new Set<() => void>();
  let media: HTMLMediaElement | null = null;
  let frame: number | null = null;
  let lastTick = 0;

  const set = (patch: Partial<PlayerState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  const clamp = (ms: number) => Math.min(Math.max(ms, 0), state.durationMs);

  const tick = (now: number) => {
    const elapsed = now - lastTick;
    lastTick = now;
    let next = media ? media.currentTime * 1000 : state.currentMs + elapsed * state.rate;
    let playing = true;
    if (state.stopAtMs !== null && next >= state.stopAtMs) {
      next = state.stopAtMs;
      playing = false;
    }
    if (next >= state.durationMs) {
      next = state.durationMs;
      playing = false;
    }
    if (!playing) {
      media?.pause();
      stopLoop();
      set({ currentMs: next, playing: false, stopAtMs: null });
      return;
    }
    set({ currentMs: next });
    frame = requestAnimationFrame(tick);
  };

  const startLoop = () => {
    if (frame !== null) return;
    lastTick = performance.now();
    frame = requestAnimationFrame(tick);
  };
  const stopLoop = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
  };

  const store: PlayerStore = {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    play() {
      if (state.playing) return;
      if (state.currentMs >= state.durationMs) store.seek(0);
      if (media) {
        media.playbackRate = state.rate;
        void media.play().catch(() => set({ playing: false }));
      }
      set({ playing: true });
      startLoop();
    },
    pause() {
      media?.pause();
      stopLoop();
      set({ playing: false, stopAtMs: null });
    },
    toggle() {
      if (state.playing) store.pause();
      else store.play();
    },
    seek(ms, options) {
      const target = clamp(ms);
      if (media) media.currentTime = target / 1000;
      set({ currentMs: target, stopAtMs: null });
      if (options?.play) store.play();
    },
    skip(deltaMs) {
      store.seek(state.currentMs + deltaMs);
    },
    setRate(rate) {
      if (media) media.playbackRate = rate;
      set({ rate });
    },
    playRange(startMs, endMs) {
      store.seek(startMs);
      set({ stopAtMs: clamp(endMs) });
      store.play();
    },
    attachMedia(element) {
      media = element;
      if (element) {
        element.playbackRate = state.rate;
        element.currentTime = state.currentMs / 1000;
        const onLoaded = () => {
          if (Number.isFinite(element.duration) && element.duration > 0) set({ durationMs: element.duration * 1000 });
        };
        element.addEventListener("loadedmetadata", onLoaded, { once: true });
      }
      set({ hasMedia: element !== null });
    },
    destroy() {
      stopLoop();
      media?.pause();
      listeners.clear();
    },
  };
  return store;
}

export const PlayerContext = createContext<PlayerStore | null>(null);

export function usePlayerStore(): PlayerStore {
  const store = useContext(PlayerContext);
  if (!store) throw new Error("usePlayerStore must be used inside <PlayerContext.Provider>");
  return store;
}

/** Subscribe to one slice of player state. Return primitives to avoid extra renders. */
export function usePlayer<T>(selector: (state: PlayerState) => T): T {
  const store = usePlayerStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}

/** Index of the segment being spoken at `ms` (binary search over sorted starts). */
export function activeIndexAt(starts: number[], ms: number): number {
  let lo = 0;
  let hi = starts.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}
