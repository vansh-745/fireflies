"""Global search across meeting titles and transcripts (SQLite FTS5)."""

from __future__ import annotations

import html
import re
from collections import OrderedDict

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models import Meeting
from app.schemas import SearchHit, SearchResponse, SearchResultMeeting

# Private-use characters mark matches inside FTS snippets; they are swapped for
# <mark> *after* HTML-escaping so transcript text can never inject markup.
_OPEN, _CLOSE = "", ""
_TOKEN = re.compile(r"[\w']+", re.UNICODE)

_FTS_SQL = text(
    f"""
    SELECT s.id, s.meeting_id, s.start_ms, p.name AS speaker,
           snippet(transcript_segments_fts, 0, '{_OPEN}', '{_CLOSE}', '…', 18) AS snippet
    FROM transcript_segments_fts
    JOIN transcript_segments s ON s.id = transcript_segments_fts.rowid
    LEFT JOIN meeting_participants mp ON mp.id = s.speaker_id
    LEFT JOIN people p ON p.id = mp.person_id
    WHERE transcript_segments_fts MATCH :query
    ORDER BY bm25(transcript_segments_fts)
    LIMIT 400
    """
)


def build_fts_query(raw: str) -> str | None:
    """User text → safe FTS5 query: every term must match, the last one as a prefix."""
    tokens = [t.replace("'", "") for t in _TOKEN.findall(raw.lower())]
    tokens = [t for t in tokens if t]
    if not tokens:
        return None
    quoted = [f'"{t}"' for t in tokens]
    quoted[-1] += "*"
    return " ".join(quoted)


def _render_snippet(snippet: str) -> str:
    return html.escape(snippet).replace(_OPEN, "<mark>").replace(_CLOSE, "</mark>")


def search(db: Session, raw_query: str, *, hits_per_meeting: int = 3, max_meetings: int = 25) -> SearchResponse:
    query = raw_query.strip()
    fts_query = build_fts_query(query)
    if not fts_query:
        return SearchResponse(query=query, results=[], total_meetings=0)

    grouped: OrderedDict[int, list[SearchHit]] = OrderedDict()
    for row in db.execute(_FTS_SQL, {"query": fts_query}).mappings():
        grouped.setdefault(row["meeting_id"], []).append(
            SearchHit(
                segment_id=row["id"],
                start_ms=row["start_ms"],
                speaker=row["speaker"],
                snippet=_render_snippet(row["snippet"]),
            )
        )

    title_matches = set(db.scalars(select(Meeting.id).where(Meeting.title.ilike(f"%{query}%"))))
    ids = list(dict.fromkeys([*sorted(title_matches, key=lambda i: i not in grouped), *grouped.keys()]))
    meetings = {m.id: m for m in db.scalars(select(Meeting).where(Meeting.id.in_(ids)))}

    results = [
        SearchResultMeeting(
            meeting_id=meeting_id,
            title=meetings[meeting_id].title,
            started_at=meetings[meeting_id].started_at,
            duration_seconds=meetings[meeting_id].duration_seconds,
            title_match=meeting_id in title_matches,
            hits=sorted(grouped.get(meeting_id, [])[:hits_per_meeting], key=lambda h: h.start_ms),
            total_hits=len(grouped.get(meeting_id, [])),
        )
        for meeting_id in ids
        if meeting_id in meetings
    ]
    return SearchResponse(query=query, results=results[:max_meetings], total_meetings=len(results))
