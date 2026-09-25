"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Light / dark / system theme. The inline script in the root layout applies the
 * stored choice before first paint; this hook reads and changes it afterwards.
 */
export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "theme";
const listeners = new Set<() => void>();

export const THEME_BOOT_SCRIPT = `(function(){try{var c=localStorage.getItem('${STORAGE_KEY}')||'light';var d=c==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):c;var e=document.documentElement;e.dataset.theme=d;e.style.colorScheme=d;}catch(_){}})();`;

function readChoice(): ThemeChoice {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "system" ? value : "light";
  } catch {
    return "light";
  }
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice !== "system") return choice;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(choice: ThemeChoice) {
  const theme = resolve(choice);
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (readChoice() === "system") {
      apply("system");
      listeners.forEach((l) => l());
    }
  };
  media.addEventListener("change", onSystemChange);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", onSystemChange);
  };
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, readChoice, () => "light" as ThemeChoice);
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light") as ResolvedTheme,
    () => "light" as ResolvedTheme,
  );
  const setTheme = useCallback((next: ThemeChoice) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the theme still applies for this page view.
    }
    apply(next);
    listeners.forEach((l) => l());
  }, []);
  return { theme: choice, resolvedTheme: resolved, setTheme };
}
