"""AskFred: question answering over one meeting.

With an Anthropic key the question goes to Claude together with the transcript.
Without one, an offline answerer handles common intents (summary, action items,
decisions, questions, speakers) and otherwise quotes the best-matching moments.
"""

from __future__ import annotations

import logging
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActionItem, ChatMessage, ChatRole, Meeting, Summary, TranscriptSegment
from app.services import llm
from app.services.meetings import segment_inputs, speaker_stats
from app.services.summarizer import SegmentInput, format_transcript_for_prompt
from app.services.text_analysis import content_words, split_sentences
from app.utils.time import format_timestamp

log = logging.getLogger(__name__)

HISTORY_TURNS = 10

CHAT_SYSTEM = (
    "You are Fred, an AI assistant that answers questions about a single meeting using its transcript. "
    "Answer only from the transcript and notes provided; if the answer is not there, say so briefly. "
    "Be concise: a short paragraph or a few bullet points in Markdown. When you reference a moment, "
    "cite its timestamp in square brackets exactly as it appears in the transcript, e.g. [04:12]."
)


def history(db: Session, meeting: Meeting) -> list[ChatMessage]:
    return list(db.scalars(select(ChatMessage).where(ChatMessage.meeting_id == meeting.id).order_by(ChatMessage.id)))


def clear_history(db: Session, meeting: Meeting) -> None:
    for message in history(db, meeting):
        db.delete(message)
    db.commit()


def ask(db: Session, meeting: Meeting, question: str) -> tuple[ChatMessage, ChatMessage, str]:
    previous = history(db, meeting)[-HISTORY_TURNS * 2 :]
    segments = segment_inputs(db, meeting)

    answer, powered_by = None, "offline"
    if llm.llm_enabled() and segments:
        try:
            answer, powered_by = _llm_answer(db, meeting, segments, previous, question), "llm"
        except llm.LLMUnavailable as exc:
            log.warning("AskFred LLM call failed, using offline answer: %s", exc)
    if answer is None:
        answer = offline_answer(db, meeting, segments, question)

    user_msg = ChatMessage(meeting_id=meeting.id, role=ChatRole.USER, content=question.strip())
    db.add(user_msg)
    db.flush()
    bot_msg = ChatMessage(meeting_id=meeting.id, role=ChatRole.ASSISTANT, content=answer)
    db.add(bot_msg)
    db.commit()
    return user_msg, bot_msg, powered_by


def _llm_answer(
    db: Session, meeting: Meeting, segments: list[SegmentInput], previous: list[ChatMessage], question: str
) -> str:
    summary = db.get(Summary, meeting.id)
    context = (
        f"Meeting: {meeting.title} ({meeting.started_at:%B %d, %Y})\n"
        f"Participants: {', '.join(p.person.name for p in meeting.participants)}\n"
        + (f"Summary:\n{summary.overview}\n" if summary and summary.overview else "")
        + f"\n<transcript>\n{format_transcript_for_prompt(segments)}\n</transcript>"
    )
    # The transcript is identical on every turn, so cache it.
    system = [
        {"type": "text", "text": CHAT_SYSTEM},
        {"type": "text", "text": context, "cache_control": {"type": "ephemeral"}},
    ]
    messages = [{"role": m.role.value, "content": m.content} for m in previous]
    messages.append({"role": "user", "content": question})
    return llm.complete(system=system, messages=messages, max_tokens=4000, effort="low")


# ── Offline answerer ─────────────────────────────────────────────────────────

_INTENTS: list[tuple[str, re.Pattern[str]]] = [
    ("actions", re.compile(r"\b(action items?|tasks?|to-?dos?|next steps?|follow[- ]?ups?|owners?|assigned)\b", re.I)),
    ("decisions", re.compile(r"\b(decid\w*|decisions?|agree\w*|conclu\w*|outcomes?)\b", re.I)),
    ("questions", re.compile(r"\b(questions?|asked|ask)\b", re.I)),
    ("speakers", re.compile(r"\b(who (talked|spoke)|talk(ed)? the most|speakers?|talk time)\b", re.I)),
    (
        "summary",
        re.compile(r"\b(summar\w*|recap|overview|tl;?dr|gist|key points?|highlights?)\b|what was (this|the) (meeting|call) about", re.I),
    ),
]
_DECISION = re.compile(r"\b(decided|agreed|let's go with|we'll go with|final answer|we're going with|sounds like a plan|approved)\b", re.I)


def _intent(question: str) -> str | None:
    for name, pattern in _INTENTS:
        if pattern.search(question):
            return name
    return None


def _quote(seg: SegmentInput, text: str | None = None) -> str:
    return f"- [{format_timestamp(seg.start_ms)}] **{seg.speaker}:** {text or seg.text}"


def offline_answer(db: Session, meeting: Meeting, segments: list[SegmentInput], question: str) -> str:
    if not segments:
        return "This meeting doesn't have a transcript yet, so there's nothing for me to search."

    intent = _intent(question)
    if intent == "actions":
        items = list(db.scalars(select(ActionItem).where(ActionItem.meeting_id == meeting.id).order_by(ActionItem.position)))
        if not items:
            return "I didn't find any action items in this meeting."
        lines = [
            f"- {'~~' + i.text + '~~' if i.is_completed else i.text}"
            + (f" — **{i.assignee.name}**" if i.assignee else "")
            + (f" [{format_timestamp(i.segment.start_ms)}]" if i.segment else "")
            for i in items
        ]
        return "Here are the action items from this meeting:\n\n" + "\n".join(lines)

    if intent == "summary":
        summary = db.get(Summary, meeting.id)
        if summary and summary.overview:
            return f"**{summary.gist}**\n\n{summary.overview}"

    if intent == "speakers":
        stats = speaker_stats(meeting, _segments_for_stats(db, meeting))
        lines = [f"- **{s.name}** — {s.talk_percent:.0f}% of talk time ({s.words_per_minute} wpm)" for s in stats]
        return "Talk time by speaker:\n\n" + "\n".join(lines)

    if intent == "decisions":
        hits = [(seg, sentence) for seg in segments for sentence in split_sentences(seg.text) if _DECISION.search(sentence)]
        if hits:
            return "These moments sound like decisions:\n\n" + "\n".join(_quote(seg, s) for seg, s in hits[:6])

    if intent == "questions" and not _keyword_terms(question, exclude={"question", "questions", "asked", "ask"}):
        asked = [(seg, s) for seg in segments for s in split_sentences(seg.text) if s.endswith("?")]
        if asked:
            return f"{len(asked)} questions were asked. Some of them:\n\n" + "\n".join(_quote(seg, s) for seg, s in asked[:8])

    terms = _keyword_terms(question)
    if not terms:
        return "Try asking about a topic, a person or a decision, e.g. “What did we decide about pricing?”"
    scored = []
    for seg in segments:
        tokens = set(content_words(seg.text))
        score = sum(1 for t in terms if any(tok.startswith(t[:5]) for tok in tokens))
        speaker_bonus = sum(1 for t in terms if t in seg.speaker.lower())
        if score or speaker_bonus:
            scored.append((score + 0.5 * speaker_bonus, seg))
    if not scored:
        return f"I couldn't find anything about “{' '.join(terms)}” in this transcript."
    best = sorted(sorted(scored, key=lambda x: -x[0])[:4], key=lambda x: x[1].start_ms)
    return "Here's what was said about that:\n\n" + "\n".join(_quote(seg) for _, seg in best)


def _keyword_terms(question: str, exclude: set[str] | None = None) -> list[str]:
    ignore = {"meeting", "call", "discuss", "discussed", "talk", "talked", "say", "said", "mention", "mentioned", "tell"}
    ignore |= exclude or set()
    return [w for w in content_words(question) if w not in ignore]



def _segments_for_stats(db: Session, meeting: Meeting) -> list[TranscriptSegment]:
    return list(
        db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.position))
    )
