"""Meeting notes generation: an LLM path (Claude) and an offline heuristic path.

Both return the same ``SummaryDraft`` so the persistence code does not care
which one produced the notes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.config import get_settings
from app.models import SummarySource
from app.services import llm
from app.services.text_analysis import extract_action_items, extract_keywords, rank_sentences
from app.utils.time import format_timestamp

log = logging.getLogger(__name__)


@dataclass
class SegmentInput:
    speaker: str
    text: str
    start_ms: int
    end_ms: int


@dataclass
class ChapterDraft:
    title: str
    start_ms: int
    bullets: list[str]


@dataclass
class ActionDraft:
    text: str
    assignee: str | None
    segment_index: int | None


@dataclass
class SummaryDraft:
    gist: str
    overview: str
    keywords: list[str]
    chapters: list[ChapterDraft]
    action_items: list[ActionDraft]
    source: SummarySource
    model: str | None = None
    notes: list[str] = field(default_factory=list)


# ── Heuristic ────────────────────────────────────────────────────────────────


def _first_name(name: str) -> str:
    return name.split()[0] if name else name


def _join_human(items: list[str]) -> str:
    if len(items) <= 1:
        return "".join(items)
    return f"{', '.join(items[:-1])} and {items[-1]}"


def _truncate(text: str, limit: int = 200) -> str:
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def heuristic_summary(title: str, segments: list[SegmentInput], participants: list[str]) -> SummaryDraft:
    pairs = [(s.speaker, s.text) for s in segments]
    name_tokens = {w for p in participants + [s.speaker for s in segments] for w in p.lower().split()}
    keywords = extract_keywords([s.text for s in segments], limit=8, exclude=name_tokens)
    ranked = rank_sentences(pairs, keywords)

    duration_min = max(1, round((segments[-1].end_ms - segments[0].start_ms) / 60_000))
    talk: dict[str, int] = {}
    for s in segments:
        talk[s.speaker] = talk.get(s.speaker, 0) + (s.end_ms - s.start_ms)
    speakers = sorted(talk, key=lambda name: -talk[name])
    topics = [k.lower() for k in keywords[:3]]

    if topics:
        gist = f"Discussion of {_join_human(topics)}."
    else:
        gist = f"A {duration_min}-minute conversation between {_join_human([_first_name(s) for s in speakers[:3]])}."

    opener = (
        f"{_join_human([_first_name(s) for s in speakers[:4]])} met for about {duration_min} minutes"
        + (f" to discuss {_join_human(topics)}." if topics else ".")
    )
    highlights = sorted(ranked[:4], key=lambda r: r.segment_index)
    overview_lines = [f"- {opener}"] + [
        f"- {_first_name(r.speaker)}: “{_truncate(r.text, 180)}”" for r in highlights
    ]

    actions = [
        ActionDraft(text=_truncate(a.text, 180), assignee=a.assignee, segment_index=a.segment_index)
        for a in extract_action_items(pairs, participants)[:8]
    ]

    return SummaryDraft(
        gist=gist,
        overview="\n".join(overview_lines),
        keywords=keywords,
        chapters=_heuristic_chapters(segments, name_tokens),
        action_items=actions,
        source=SummarySource.HEURISTIC,
    )


def _heuristic_chapters(segments: list[SegmentInput], exclude: set[str]) -> list[ChapterDraft]:
    start, end = segments[0].start_ms, segments[-1].end_ms
    duration_min = (end - start) / 60_000
    count = max(1, min(6, round(duration_min / 4), len(segments) // 4))
    span = (end - start) / count

    # Chunk by elapsed time, snapping each boundary to the next segment start.
    chunks: list[list[SegmentInput]] = [[] for _ in range(count)]
    for seg in segments:
        chunks[min(count - 1, int((seg.start_ms - start) / span))].append(seg)

    chapters: list[ChapterDraft] = []
    for number, chunk in enumerate(c for c in chunks if c):
        kws = extract_keywords([s.text for s in chunk], limit=2, exclude=exclude)
        title = " & ".join(kws) if kws else f"Part {number + 1}"
        ranked = rank_sentences([(s.speaker, s.text) for s in chunk])
        best = sorted(ranked[:3], key=lambda r: r.segment_index)
        bullets = [f"{_first_name(r.speaker)}: {_truncate(r.text, 180)}" for r in best]
        chapters.append(ChapterDraft(title=title, start_ms=chunk[0].start_ms, bullets=bullets))
    return chapters


# ── LLM ──────────────────────────────────────────────────────────────────────

SUMMARY_SCHEMA = {
    "type": "object",
    "properties": {
        "gist": {"type": "string", "description": "One sentence (max 25 words) describing the meeting."},
        "overview": {
            "type": "array",
            "items": {"type": "string"},
            "description": "3-6 concise bullet points covering decisions and outcomes.",
        },
        "keywords": {"type": "array", "items": {"type": "string"}, "description": "5-8 short topic keywords."},
        "chapters": {
            "type": "array",
            "description": "3-6 chronological sections of the meeting.",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "start_segment": {"type": "integer", "description": "Index (#) of the segment where it begins."},
                    "bullets": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["title", "start_segment", "bullets"],
                "additionalProperties": False,
            },
        },
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Imperative task, e.g. 'Send the pricing deck to Acme'."},
                    "assignee": {"type": "string", "description": "Exact participant name, or empty string if unowned."},
                    "segment": {"type": "integer", "description": "Index (#) of the segment where it was agreed."},
                },
                "required": ["text", "assignee", "segment"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["gist", "overview", "keywords", "chapters", "action_items"],
    "additionalProperties": False,
}

SUMMARY_SYSTEM = (
    "You are Fred, the AI notetaker in a meeting-assistant app. You turn meeting transcripts into "
    "accurate, skimmable notes for people who did not attend. Only state what the transcript supports. "
    "Write action items only for concrete commitments or requests, phrased as imperative tasks. "
    "Refer to transcript segments by their # index."
)


def format_transcript_for_prompt(segments: list[SegmentInput]) -> str:
    return "\n".join(
        f"#{i} [{format_timestamp(s.start_ms)}] {s.speaker}: {s.text}" for i, s in enumerate(segments)
    )


def llm_summary(title: str, segments: list[SegmentInput], participants: list[str]) -> SummaryDraft:
    prompt = (
        f"Meeting title: {title}\n"
        f"Participants: {', '.join(participants) or 'unknown'}\n\n"
        f"<transcript>\n{format_transcript_for_prompt(segments)}\n</transcript>\n\n"
        "Write the meeting notes."
    )
    data = llm.complete_json(
        system=SUMMARY_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
        json_schema=SUMMARY_SCHEMA,
    )

    last = len(segments) - 1
    by_lower = {p.lower(): p for p in participants}

    def clamp(index: object) -> int:
        return max(0, min(last, index)) if isinstance(index, int) else 0

    chapters = [
        ChapterDraft(
            title=str(c.get("title", "")).strip()[:200] or "Discussion",
            start_ms=segments[clamp(c.get("start_segment"))].start_ms,
            bullets=[str(b).strip() for b in c.get("bullets", []) if str(b).strip()],
        )
        for c in data.get("chapters", [])
    ]
    chapters.sort(key=lambda c: c.start_ms)
    actions = [
        ActionDraft(
            text=str(a.get("text", "")).strip()[:500],
            assignee=by_lower.get(str(a.get("assignee", "")).strip().lower()),
            segment_index=clamp(a.get("segment")),
        )
        for a in data.get("action_items", [])
        if str(a.get("text", "")).strip()
    ]
    return SummaryDraft(
        gist=str(data.get("gist", "")).strip()[:300],
        overview="\n".join(f"- {str(line).strip().lstrip('-• ').strip()}" for line in data.get("overview", []) if str(line).strip()),
        keywords=[str(k).strip() for k in data.get("keywords", []) if str(k).strip()][:10],
        chapters=chapters,
        action_items=actions,
        source=SummarySource.LLM,
        model=get_settings().llm_model,
    )


def generate_summary(title: str, segments: list[SegmentInput], participants: list[str], *, use_llm: bool) -> SummaryDraft:
    """LLM notes when requested and available, otherwise (or on failure) heuristic notes."""
    if not segments:
        return SummaryDraft("", "", [], [], [], SummarySource.HEURISTIC)
    if use_llm and llm.llm_enabled():
        try:
            return llm_summary(title, segments, participants)
        except llm.LLMUnavailable as exc:
            log.warning("LLM summary failed, using heuristic notes: %s", exc)
            draft = heuristic_summary(title, segments, participants)
            draft.notes.append(str(exc))
            return draft
    return heuristic_summary(title, segments, participants)
