"""Turn uploaded/pasted transcript files into timed, speaker-labelled segments.

Supported formats
-----------------
* ``txt``  – one utterance per line: ``Speaker: text``, optionally prefixed with a
             timestamp such as ``[00:01:23]``, ``00:01:23`` or ``(1:23)``.
             Lines without a speaker continue the previous utterance.
* ``vtt``  – WebVTT; speakers from ``<v Name>`` voice tags or a ``Name:`` prefix.
* ``srt``  – SubRip; speakers from a ``Name:`` prefix.
* ``json`` – a list of ``{speaker, text, start, end}`` objects (seconds or ms),
             or an object with a ``segments`` / ``sentences`` list in the same shape.

When a format carries no timing information, timings are estimated from word
counts at a natural speaking rate so the player and transcript stay usable.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

WORDS_PER_SECOND = 2.6
GAP_MS = 600
MIN_SEGMENT_MS = 1200
UNKNOWN_SPEAKER = "Speaker"


class TranscriptParseError(ValueError):
    pass


@dataclass
class ParsedSegment:
    speaker: str
    text: str
    start_ms: int | None = None
    end_ms: int | None = None


SUPPORTED_FORMATS = ("txt", "vtt", "srt", "json")

_TIMESTAMP = r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?"
_LEADING_TS = re.compile(rf"^\s*[\[(]?\s*{_TIMESTAMP}\s*[\])]?\s*[-–|]?\s*")
_SPEAKER_LINE = re.compile(r"^\s*([A-Z][\w.'\- ]{0,48}?)\s*:\s+(.+)$")
_NAME_PARTICLES = {"de", "da", "del", "der", "van", "von", "bin", "al", "la", "le"}
_CUE_TIMING = re.compile(rf"{_TIMESTAMP}\s*-->\s*{_TIMESTAMP}")
_VOICE_TAG = re.compile(r"<v(?:\.[\w.]+)?\s+([^>]+)>")
_TAG = re.compile(r"</?[^>]+>")


def detect_format(filename: str | None, content: str) -> str:
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower()
        if ext in SUPPORTED_FORMATS:
            return ext
    stripped = content.lstrip()
    if stripped.startswith("WEBVTT"):
        return "vtt"
    if stripped.startswith(("[", "{")):
        return "json"
    if _CUE_TIMING.search(content[:500]):
        return "srt"
    return "txt"


def parse_transcript(content: str, fmt: str | None = None, filename: str | None = None) -> list[ParsedSegment]:
    content = content.replace("\r\n", "\n").replace("﻿", "").strip()
    if not content:
        raise TranscriptParseError("The transcript is empty.")

    fmt = (fmt or detect_format(filename, content)).lower()
    parsers = {"txt": _parse_txt, "vtt": _parse_cues, "srt": _parse_cues, "json": _parse_json}
    if fmt not in parsers:
        raise TranscriptParseError(f"Unsupported transcript format '{fmt}'. Use one of: {', '.join(SUPPORTED_FORMATS)}.")

    segments = [s for s in parsers[fmt](content) if s.text.strip()]
    if not segments:
        raise TranscriptParseError("No dialogue could be found in the transcript.")
    segments = _merge_consecutive(segments)
    _fill_timings(segments)
    return segments


# ── Format parsers ───────────────────────────────────────────────────────────


def _speaker_prefix(line: str) -> tuple[str, str] | None:
    """Split ``"Name: text"``; rejects prose such as ``"So the plan is: ..."``."""
    match = _SPEAKER_LINE.match(line)
    if not match:
        return None
    words = match.group(1).split()
    if not 1 <= len(words) <= 4:
        return None
    if not all(w[0].isupper() or w[0].isdigit() or w.lower() in _NAME_PARTICLES for w in words):
        return None
    return match.group(1).strip(), match.group(2).strip()


def _ts_to_ms(hours: str | None, minutes: str, seconds: str, fraction: str | None) -> int:
    ms = (int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds)) * 1000
    if fraction:
        ms += int(fraction.ljust(3, "0")[:3])
    return ms


def _parse_txt(content: str) -> list[ParsedSegment]:
    segments: list[ParsedSegment] = []
    for raw_line in content.split("\n"):
        line = raw_line.strip()
        if not line:
            continue
        start_ms = None
        ts_match = _LEADING_TS.match(line)
        if ts_match and ts_match.end() < len(line):
            start_ms = _ts_to_ms(*ts_match.groups())
            line = line[ts_match.end() :]

        prefix = _speaker_prefix(line)
        if prefix:
            segments.append(ParsedSegment(speaker=prefix[0], text=prefix[1], start_ms=start_ms))
        elif segments and start_ms is None:
            segments[-1].text += " " + line
        else:
            speaker = segments[-1].speaker if segments else UNKNOWN_SPEAKER
            segments.append(ParsedSegment(speaker=speaker, text=line, start_ms=start_ms))
    return segments


def _parse_cues(content: str) -> list[ParsedSegment]:
    """Shared WebVTT/SRT parser: blocks separated by blank lines, each with a timing line."""
    segments: list[ParsedSegment] = []
    for block in re.split(r"\n\s*\n", content):
        lines = [line.strip() for line in block.split("\n") if line.strip()]
        timing_index = next((i for i, line in enumerate(lines) if _CUE_TIMING.search(line)), None)
        if timing_index is None:
            continue  # header, NOTE or STYLE block
        groups = _CUE_TIMING.search(lines[timing_index]).groups()  # type: ignore[union-attr]
        start_ms, end_ms = _ts_to_ms(*groups[:4]), _ts_to_ms(*groups[4:])
        text = " ".join(lines[timing_index + 1 :])
        if not text:
            continue

        speaker = None
        voice = _VOICE_TAG.search(text)
        if voice:
            speaker = voice.group(1).strip()
        text = _TAG.sub("", text).strip()
        prefix = _speaker_prefix(text)
        if speaker is None and prefix:
            speaker, text = prefix
        if speaker is None:
            speaker = segments[-1].speaker if segments else UNKNOWN_SPEAKER
        segments.append(ParsedSegment(speaker=speaker, text=text, start_ms=start_ms, end_ms=end_ms))
    return segments


def _parse_json(content: str) -> list[ParsedSegment]:
    try:
        data = json.loads(content)
    except json.JSONDecodeError as exc:
        raise TranscriptParseError(f"Invalid JSON: {exc.msg} (line {exc.lineno}).") from exc

    if isinstance(data, dict):
        data = next((data[k] for k in ("segments", "sentences", "transcript", "utterances") if isinstance(data.get(k), list)), None)
    if not isinstance(data, list):
        raise TranscriptParseError("JSON transcripts must be a list of segments or contain a 'segments' list.")

    # Decide once whether numbers are seconds or milliseconds.
    ends = [item.get("end", item.get("end_time")) for item in data if isinstance(item, dict)]
    numeric_ends = [e for e in ends if isinstance(e, (int, float))]
    scale = 1 if numeric_ends and max(numeric_ends) > 10_000 else 1000

    segments: list[ParsedSegment] = []
    for item in data:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("content") or "").strip()
        speaker = str(item.get("speaker") or item.get("speaker_name") or item.get("name") or UNKNOWN_SPEAKER).strip()
        start = item.get("start", item.get("start_time"))
        end = item.get("end", item.get("end_time"))
        segments.append(
            ParsedSegment(
                speaker=speaker,
                text=text,
                start_ms=int(float(start) * scale) if isinstance(start, (int, float)) else None,
                end_ms=int(float(end) * scale) if isinstance(end, (int, float)) else None,
            )
        )
    return segments


# ── Normalisation ────────────────────────────────────────────────────────────


def _merge_consecutive(segments: list[ParsedSegment]) -> list[ParsedSegment]:
    """Caption formats split one speaker's turn over many short cues; join them back up."""
    merged: list[ParsedSegment] = []
    for seg in segments:
        seg.text = re.sub(r"\s+", " ", seg.text).strip()
        prev = merged[-1] if merged else None
        if (
            prev is not None
            and prev.speaker == seg.speaker
            and len(prev.text.split()) < 60
            and (seg.start_ms is None or prev.end_ms is None or seg.start_ms - prev.end_ms < 1500)
            and not (seg.start_ms is not None and prev.end_ms is None)
        ):
            prev.text = f"{prev.text} {seg.text}"
            prev.end_ms = seg.end_ms if seg.end_ms is not None else prev.end_ms
        else:
            merged.append(seg)
    return merged


def estimate_duration_ms(text: str) -> int:
    return max(MIN_SEGMENT_MS, int(len(text.split()) / WORDS_PER_SECOND * 1000))


def _fill_timings(segments: list[ParsedSegment]) -> None:
    """Fill in missing start/end times and make them monotonic."""
    cursor = 0
    for i, seg in enumerate(segments):
        if seg.start_ms is None or seg.start_ms < cursor:
            seg.start_ms = cursor
        if seg.end_ms is None or seg.end_ms <= seg.start_ms:
            natural_end = seg.start_ms + estimate_duration_ms(seg.text)
            next_start = segments[i + 1].start_ms if i + 1 < len(segments) else None
            if next_start is not None and next_start > seg.start_ms:
                natural_end = min(natural_end, next_start)
            seg.end_ms = natural_end
        cursor = seg.end_ms + GAP_MS if segments[i + 1 :] and segments[i + 1].start_ms is None else seg.end_ms
