"use client";

import { ArrowUp, Bot, Eraser, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { IconButton } from "@/components/ui/button";
import { firstName } from "@/lib/format";
import { useAsk, useChat, useClearChat, useMe } from "@/lib/queries";

import { useMeetingUI } from "./meeting-context";
import { RichText } from "./rich-text";

export function AskFredPanel() {
  const { meeting } = useMeetingUI();
  const { data: messages = [] } = useChat(meeting.id);
  const { data: me } = useMe();
  const ask = useAsk(meeting.id);
  const clear = useClearChat(meeting.id);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const topSpeaker = meeting.speaker_stats.find((s) => s.participant_id !== null);
  const topic = meeting.summary?.keywords[0];
  const suggestions = [
    "Summarize this meeting",
    "What are the action items?",
    "What decisions were made?",
    "What questions were asked?",
    ...(topSpeaker && topic ? [`What did ${firstName(topSpeaker.name)} say about ${topic}?`] : []),
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setPending(q);
    setQuestion("");
    ask.mutate(q, { onSettled: () => setPending(null) });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 && !pending ? (
          <div className="px-1">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-accent text-on-accent">
                <Bot className="size-4" />
              </span>
              <div>
                <div className="text-sm font-semibold text-ink">Ask Fred about this meeting</div>
                <div className="text-xs text-ink-muted">Answers cite moments you can jump to.</div>
              </div>
            </div>
            <div className="mt-4 flex flex-col gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="pressable rounded-lg border border-border bg-surface px-3 py-2 text-left text-[13px] text-ink hover:border-accent hover:bg-accent-subtle"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m) => (
              <li key={m.id} className="flex gap-2.5">
                {m.role === "user" ? (
                  <Avatar name={me?.name ?? "You"} slot={1} size="sm" />
                ) : (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Sparkles className="size-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-ink">{m.role === "user" ? "You" : "Fred"}</div>
                  <RichText text={m.content} className="mt-0.5 flex flex-col gap-1.5 text-[13px] leading-5 text-ink-muted" />
                </div>
              </li>
            ))}
            {pending && (
              <>
                <li className="flex gap-2.5">
                  <Avatar name={me?.name ?? "You"} slot={1} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-ink">You</div>
                    <p className="mt-0.5 text-[13px] text-ink-muted">{pending}</p>
                  </div>
                </li>
                <li className="flex gap-2.5" role="status">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Sparkles className="size-3.5" />
                  </span>
                  <div className="shimmer mt-1 h-10 flex-1 rounded-lg bg-surface-sunken" aria-label="Fred is thinking" />
                </li>
              </>
            )}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send(question);
          }}
          className="flex items-end gap-2 rounded-xl border border-border bg-surface px-3 py-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-subtle"
        >
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(question);
              }
            }}
            rows={1}
            placeholder="Ask about this meeting…"
            aria-label="Ask Fred"
            className="field-sizing-content max-h-28 min-h-6 flex-1 resize-none bg-transparent py-0.5 text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus-visible:outline-none"
          />
          <button
            type="submit"
            disabled={!question.trim() || ask.isPending}
            aria-label="Send"
            className="pressable inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40"
          >
            <ArrowUp className="size-4" />
          </button>
        </form>
        <div className="mt-2 flex items-center justify-between text-xxs text-ink-subtle">
          <span>{meeting.llm_available ? "Powered by Claude" : "Offline answers · set ANTHROPIC_API_KEY for Claude"}</span>
          {messages.length > 0 && (
            <IconButton label="Clear conversation" size="sm" onClick={() => clear.mutate()}>
              <Eraser className="size-3.5" />
            </IconButton>
          )}
        </div>
      </div>
    </div>
  );
}
