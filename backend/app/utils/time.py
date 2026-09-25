"""Time helpers shared by exports, prompts and the chat fallback."""

from __future__ import annotations

import re

_TIMESTAMP_TOKEN = re.compile(r"\[(\d{1,2}:)?(\d{1,2}):(\d{2})\]")


def format_timestamp(ms: int) -> str:
    """``83000`` → ``"01:23"``; hours are only shown when needed (``"1:02:03"``)."""
    total = max(0, ms) // 1000
    hours, rem = divmod(total, 3600)
    minutes, seconds = divmod(rem, 60)
    return f"{hours}:{minutes:02d}:{seconds:02d}" if hours else f"{minutes:02d}:{seconds:02d}"


def format_srt_timestamp(ms: int, separator: str = ",") -> str:
    hours, rem = divmod(max(0, ms), 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    seconds, millis = divmod(rem, 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}{separator}{millis:03d}"
