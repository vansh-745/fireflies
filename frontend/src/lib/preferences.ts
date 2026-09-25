"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Per-browser conveniences (not account data), kept in localStorage. */
export interface Preferences {
  playbackRate: number;
  autoScroll: boolean;
  emailDigest: boolean;
  notifyOnReady: boolean;
  sidebarCollapsed: boolean;
}

const DEFAULTS: Preferences = {
  playbackRate: 1,
  autoScroll: true,
  emailDigest: true,
  notifyOnReady: true,
  sidebarCollapsed: false,
};
const KEY = "ff-preferences";
const listeners = new Set<() => void>();
let cache: Preferences | null = null;

function read(): Preferences {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULTS;
  } catch {
    cache = DEFAULTS;
  }
  return cache;
}

function write(next: Preferences) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be unavailable (private mode); the in-memory value still applies.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePreferences(): [Preferences, (patch: Partial<Preferences>) => void] {
  const prefs = useSyncExternalStore(subscribe, read, () => DEFAULTS);
  const update = useCallback((patch: Partial<Preferences>) => write({ ...read(), ...patch }), []);
  return [prefs, update];
}
