"use client";

import { Fragment, type ReactNode } from "react";

import { parseTimestamp } from "@/lib/format";

import { TimestampLink } from "./timestamp-link";

/**
 * Tiny Markdown subset for AI text: "- " bullets, **bold**, ~~strike~~, `code`,
 * and [mm:ss] timestamps that seek the player. Everything else renders as text,
 * so model output can never inject markup.
 */
const INLINE = /(\*\*[^*]+\*\*|~~[^~]+~~|`[^`]+`|\[\d{1,2}:\d{2}(?::\d{2})?\])/g;

function renderInline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    if (!part) return null;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    if (part.startsWith("~~") && part.endsWith("~~")) return <s key={index} className="text-ink-subtle">{part.slice(2, -2)}</s>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={index} className="rounded bg-surface-sunken px-1 font-mono text-[12px]">{part.slice(1, -1)}</code>;
    if (part.startsWith("[") && part.endsWith("]")) {
      const ms = parseTimestamp(part.slice(1, -1));
      if (ms !== null) return <TimestampLink key={index} ms={ms} />;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flush = () => {
    if (!bullets.length) return;
    blocks.push(
      <ul key={`ul${blocks.length}`} className="flex flex-col gap-1.5 pl-1">
        {bullets.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-ink-subtle" />
            <span>{renderInline(line)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) {
      bullets.push(line.replace(/^[-*•]\s+/, ""));
      continue;
    }
    flush();
    if (line) blocks.push(<p key={`p${blocks.length}`}>{renderInline(line)}</p>);
  }
  flush();

  return <div className={className ?? "flex flex-col gap-2"}>{blocks}</div>;
}
