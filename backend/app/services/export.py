"""Download a meeting's notes and/or transcript as Markdown, plain text, SRT or PDF."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from fpdf import FPDF
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ActionItem, Chapter, Meeting, Summary
from app.services.meetings import segment_inputs
from app.services.summarizer import SegmentInput
from app.utils.time import format_srt_timestamp, format_timestamp

ExportFormat = Literal["md", "txt", "srt", "pdf"]
ExportContent = Literal["full", "summary", "transcript"]

MEDIA_TYPES: dict[str, str] = {
    "md": "text/markdown; charset=utf-8",
    "txt": "text/plain; charset=utf-8",
    "srt": "application/x-subrip; charset=utf-8",
    "pdf": "application/pdf",
}


@dataclass
class ExportData:
    meeting: Meeting
    summary: Summary | None
    chapters: list[Chapter]
    action_items: list[ActionItem]
    segments: list[SegmentInput]

    @property
    def meta_line(self) -> str:
        m = self.meeting
        minutes = max(1, round(m.duration_seconds / 60)) if m.duration_seconds else 0
        people = ", ".join(p.person.name for p in m.participants)
        return f"{m.started_at:%A, %B %d, %Y at %H:%M UTC} · {minutes} min · {people}"


def load(db: Session, meeting: Meeting) -> ExportData:
    return ExportData(
        meeting=meeting,
        summary=db.get(Summary, meeting.id),
        chapters=list(db.scalars(select(Chapter).where(Chapter.meeting_id == meeting.id).order_by(Chapter.position))),
        action_items=list(db.scalars(select(ActionItem).where(ActionItem.meeting_id == meeting.id).order_by(ActionItem.position))),
        segments=segment_inputs(db, meeting),
    )


def filename(meeting: Meeting, fmt: ExportFormat) -> str:
    slug = "".join(c if c.isalnum() else "-" for c in meeting.title.lower()).strip("-")
    while "--" in slug:
        slug = slug.replace("--", "-")
    return f"{slug or 'meeting'}.{fmt}"


def render(data: ExportData, fmt: ExportFormat, content: ExportContent) -> bytes:
    if fmt == "srt":
        return to_srt(data.segments).encode()
    if fmt == "pdf":
        return to_pdf(data, content)
    text = to_markdown(data, content) if fmt == "md" else to_text(data, content)
    return text.encode()


# ── Text formats ─────────────────────────────────────────────────────────────


def _action_line(item: ActionItem) -> str:
    owner = f" — {item.assignee.name}" if item.assignee else ""
    due = f" (due {item.due_date:%b %d})" if item.due_date else ""
    return f"{item.text}{owner}{due}"


def to_markdown(data: ExportData, content: ExportContent) -> str:
    out = [f"# {data.meeting.title}", "", f"_{data.meta_line}_", ""]
    if data.meeting.tags:
        out += ["Tags: " + ", ".join(f"`{t.name}`" for t in data.meeting.tags), ""]
    if content in ("full", "summary"):
        if data.summary:
            out += ["## Summary", ""]
            if data.summary.gist:
                out += [f"**{data.summary.gist}**", ""]
            out += [data.summary.overview, ""]
            if data.summary.keywords:
                out += ["**Keywords:** " + ", ".join(data.summary.keywords), ""]
        if data.chapters:
            out += ["## Outline", ""]
            for ch in data.chapters:
                out += [f"### [{format_timestamp(ch.start_ms)}] {ch.title}", *[f"- {b}" for b in ch.bullets], ""]
        if data.action_items:
            out += ["## Action items", ""]
            out += [f"- [{'x' if i.is_completed else ' '}] {_action_line(i)}" for i in data.action_items]
            out += [""]
    if content in ("full", "transcript"):
        out += ["## Transcript", ""]
        out += [f"**[{format_timestamp(s.start_ms)}] {s.speaker}:** {s.text}  " for s in data.segments]
    return "\n".join(out).strip() + "\n"


def to_text(data: ExportData, content: ExportContent) -> str:
    out = [data.meeting.title, data.meta_line, ""]
    if content in ("full", "summary"):
        if data.summary:
            out += ["SUMMARY", data.summary.gist, data.summary.overview, ""]
            if data.summary.keywords:
                out += ["Keywords: " + ", ".join(data.summary.keywords), ""]
        if data.chapters:
            out += ["OUTLINE"]
            for ch in data.chapters:
                out += [f"[{format_timestamp(ch.start_ms)}] {ch.title}", *[f"  - {b}" for b in ch.bullets]]
            out += [""]
        if data.action_items:
            out += ["ACTION ITEMS", *[f"[{'x' if i.is_completed else ' '}] {_action_line(i)}" for i in data.action_items], ""]
    if content in ("full", "transcript"):
        if content == "full":
            out += ["TRANSCRIPT"]
        out += [f"[{format_timestamp(s.start_ms)}] {s.speaker}: {s.text}" for s in data.segments]
    return "\n".join(out).strip() + "\n"


def to_srt(segments: list[SegmentInput]) -> str:
    cues = [
        f"{i}\n{format_srt_timestamp(s.start_ms)} --> {format_srt_timestamp(s.end_ms)}\n{s.speaker}: {s.text}\n"
        for i, s in enumerate(segments, start=1)
    ]
    return "\n".join(cues)


# ── PDF ──────────────────────────────────────────────────────────────────────

_ASCII = str.maketrans({"“": '"', "”": '"', "‘": "'", "’": "'", "—": "-", "–": "-", "…": "...", "•": "-", "·": "-"})
BRAND = (108, 71, 255)
MUTED = (110, 110, 125)


def _latin1(text: str) -> str:
    """The built-in PDF fonts only cover Latin-1."""
    return text.translate(_ASCII).encode("latin-1", "replace").decode("latin-1")


class _MeetingPDF(FPDF):
    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("Helvetica", size=8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, f"Page {self.page_no()}", align="C")


def to_pdf(data: ExportData, content: ExportContent) -> bytes:
    pdf = _MeetingPDF(format="A4")
    pdf.set_margins(18, 18, 18)
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.add_page()

    def heading(text: str, size: int = 13) -> None:
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", size)
        pdf.set_text_color(*BRAND)
        pdf.multi_cell(0, 7, _latin1(text), new_x="LMARGIN", new_y="NEXT")
        pdf.set_text_color(20, 20, 30)

    def paragraph(text: str, size: int = 10, style: str = "", height: float = 5.2) -> None:
        pdf.set_font("Helvetica", style, size)
        pdf.multi_cell(0, height, _latin1(text), new_x="LMARGIN", new_y="NEXT")

    pdf.set_font("Helvetica", "B", 18)
    pdf.multi_cell(0, 9, _latin1(data.meeting.title), new_x="LMARGIN", new_y="NEXT")
    pdf.set_text_color(*MUTED)
    paragraph(data.meta_line, size=9)
    pdf.set_text_color(20, 20, 30)

    if content in ("full", "summary"):
        if data.summary:
            heading("Summary")
            if data.summary.gist:
                paragraph(data.summary.gist, style="B")
            for line in data.summary.overview.splitlines():
                if line.strip():
                    paragraph(line.strip())
            if data.summary.keywords:
                paragraph("Keywords: " + ", ".join(data.summary.keywords), size=9, style="I")
        if data.chapters:
            heading("Outline")
            for ch in data.chapters:
                paragraph(f"[{format_timestamp(ch.start_ms)}] {ch.title}", style="B")
                for bullet in ch.bullets:
                    paragraph(f"  - {bullet}", size=9.5)
        if data.action_items:
            heading("Action items")
            for item in data.action_items:
                paragraph(f"[{'x' if item.is_completed else ' '}] {_action_line(item)}")
    if content in ("full", "transcript"):
        heading("Transcript")
        for seg in data.segments:
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*BRAND)
            pdf.cell(0, 5, _latin1(f"{seg.speaker}  {format_timestamp(seg.start_ms)}"), new_x="LMARGIN", new_y="NEXT")
            pdf.set_text_color(20, 20, 30)
            paragraph(seg.text, size=9.5, height=4.8)
            pdf.ln(1.5)

    return bytes(pdf.output())
