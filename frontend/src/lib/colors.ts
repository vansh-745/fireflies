import type { CSSProperties } from "react";

const SPEAKER_SLOTS = 8;

/** Stable colour slot (1–8) for a name, so a person keeps their colour across pages. */
export function colorSlot(key: string | number): number {
  const text = String(key);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return (hash % SPEAKER_SLOTS) + 1;
}

export function speakerStyle(slot: number): CSSProperties {
  return {
    "--chip-bg": `var(--speaker-${slot}-bg)`,
    "--chip-ink": `var(--speaker-${slot}-ink)`,
    "--chip-solid": `var(--speaker-${slot})`,
  } as CSSProperties;
}

/** Tag colours from the API map onto speaker slots so they share the palette. */
const TAG_SLOTS: Record<string, number> = {
  violet: 1,
  rose: 2,
  emerald: 3,
  amber: 4,
  blue: 5,
  fuchsia: 6,
  cyan: 3,
  orange: 8,
};

export function tagSlot(color: string): number {
  return TAG_SLOTS[color] ?? 1;
}
