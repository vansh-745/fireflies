"""Load the demo workspace.

    python -m app.seed.seed           # seed if the database is empty
    python -m app.seed.seed --reset   # drop everything and reseed
"""

from __future__ import annotations

import argparse
import logging
from datetime import datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine, init_db
from app.models import (
    ActionItem,
    Comment,
    Meeting,
    MeetingSource,
    Notification,
    Soundbite,
    SummarySource,
    TranscriptSegment,
    User,
    utcnow,
)
from app.schemas import MeetingCreate, ParticipantIn
from app.seed.data import MEETINGS, PEOPLE, SeedMeeting
from app.services.directory import DEFAULT_USER
from app.services.meetings import insert_meeting, persist_summary
from app.services.summarizer import ActionDraft, ChapterDraft, SummaryDraft
from app.services.transcript_parser import parse_transcript

log = logging.getLogger(__name__)


def _start_time(spec: SeedMeeting, now: datetime) -> datetime:
    if spec.days_ago == 0:
        # "Earlier today": a couple of hours ago, on the half hour.
        start = now - timedelta(hours=2)
        return start.replace(minute=0 if start.minute < 30 else 30, second=0, microsecond=0)
    return (now - timedelta(days=spec.days_ago)).replace(hour=spec.hour, minute=spec.minute, second=0, microsecond=0)


def _find(segments: list[TranscriptSegment], snippet: str) -> TranscriptSegment:
    for seg in segments:
        if snippet.lower() in seg.text.lower():
            return seg
    raise ValueError(f"Seed snippet not found in transcript: {snippet!r}")


def _seed_meeting(db: Session, user: User, spec: SeedMeeting, now: datetime) -> Meeting:
    parsed = parse_transcript(spec.transcript, "txt")
    started_at = _start_time(spec, now)
    data = MeetingCreate(
        title=spec.title,
        started_at=started_at,
        platform=spec.platform,
        participants=[ParticipantIn(name=name, email=PEOPLE.get(name), role=role) for name, role in spec.participants],
        tags=spec.tags,
    )
    meeting = insert_meeting(db, user, data, source=MeetingSource.SEED, segments=parsed)
    meeting.created_at = started_at + timedelta(seconds=meeting.duration_seconds + 120)
    segments = list(db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.position)))
    index_of = {seg.id: i for i, seg in enumerate(segments)}

    draft = SummaryDraft(
        gist=spec.gist,
        overview="\n".join(f"- {line}" for line in spec.overview),
        keywords=spec.keywords,
        chapters=[ChapterDraft(c.title, _find(segments, c.at).start_ms, c.bullets) for c in spec.chapters],
        action_items=[ActionDraft(a.text, a.assignee, index_of[_find(segments, a.at).id]) for a in spec.actions],
        source=SummarySource.SEED,
    )
    persist_summary(db, meeting, draft)

    items = {i.text: i for i in db.scalars(select(ActionItem).where(ActionItem.meeting_id == meeting.id))}
    for action in spec.actions:
        item = items[action.text]
        if action.done:
            item.is_completed = True
            item.completed_at = min(now, started_at + timedelta(days=1))
        if action.due_in_days is not None:
            item.due_date = (started_at + timedelta(days=action.due_in_days)).date()

    for at, body in spec.comments:
        db.add(Comment(segment_id=_find(segments, at).id, author_id=user.id, body=body, created_at=started_at + timedelta(hours=3)))
    for title, from_at, to_at in spec.soundbites:
        first, last = _find(segments, from_at), _find(segments, to_at)
        db.add(Soundbite(meeting_id=meeting.id, title=title, start_ms=first.start_ms, end_ms=last.end_ms, created_by_id=user.id))
    return meeting


def seed_database(reset: bool = False) -> int:
    if reset:
        with engine.begin() as conn:
            conn.execute(text("DROP TABLE IF EXISTS transcript_segments_fts"))
        Base.metadata.drop_all(bind=engine)
    init_db()

    with SessionLocal() as db:
        if db.scalar(select(func.count(Meeting.id))):
            log.info("Database already has meetings — skipping seed (use --reset to reseed)")
            return 0
        # Claim the seed by creating the default user. When several serverless instances start
        # at once against a shared database, only one insert succeeds (users.email is unique).
        user = User(**DEFAULT_USER)
        db.add(user)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            log.info("Workspace already initialised by another process — skipping seed")
            return 0
        now = utcnow()
        meetings = [_seed_meeting(db, user, spec, now) for spec in MEETINGS]

        newest = sorted(meetings, key=lambda m: m.started_at, reverse=True)
        for i, meeting in enumerate(newest[:3]):
            db.add(
                Notification(
                    user_id=user.id,
                    kind="meeting_ready",
                    title=f"“{meeting.title}” is ready",
                    body="Transcript and AI notes are available.",
                    meeting_id=meeting.id,
                    is_read=i > 0,
                    created_at=meeting.created_at,
                )
            )
        db.commit()
        log.info("Seeded %d meetings", len(meetings))
        return len(meetings)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description="Seed the demo workspace.")
    parser.add_argument("--reset", action="store_true", help="drop all tables and reseed")
    args = parser.parse_args()
    seed_database(reset=args.reset)
