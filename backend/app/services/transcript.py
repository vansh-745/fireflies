"""Transcript read model, segment edits, comments and soundbites."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.errors import InvalidInputError, NotFoundError
from app.models import ActionItem, Comment, Meeting, MeetingParticipant, Soundbite, TranscriptSegment, User
from app.schemas import CommentCreate, CommentOut, SegmentOut, SegmentUpdate, SoundbiteCreate, SpeakerRef
from app.services.text_analysis import segment_flags


def list_segments(db: Session, meeting: Meeting) -> list[SegmentOut]:
    segments = list(
        db.scalars(
            select(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting.id)
            .options(joinedload(TranscriptSegment.speaker).joinedload(MeetingParticipant.person))
            .order_by(TranscriptSegment.position)
        ).unique()
    )
    comment_counts = dict(
        db.execute(
            select(Comment.segment_id, func.count(Comment.id))
            .join(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == meeting.id)
            .group_by(Comment.segment_id)
        ).all()
    )
    task_segments = set(
        db.scalars(select(ActionItem.segment_id).where(ActionItem.meeting_id == meeting.id, ActionItem.segment_id.is_not(None)))
    )
    return [_segment_out(s, comment_counts.get(s.id, 0), s.id in task_segments) for s in segments]


def _segment_out(segment: TranscriptSegment, comment_count: int, is_task: bool) -> SegmentOut:
    speaker = None
    if segment.speaker is not None:
        speaker = SpeakerRef(
            participant_id=segment.speaker.id, person_id=segment.speaker.person_id, name=segment.speaker.person.name
        )
    flags = segment_flags(segment.text) + (["task"] if is_task else [])
    return SegmentOut(
        id=segment.id,
        position=segment.position,
        start_ms=segment.start_ms,
        end_ms=segment.end_ms,
        text=segment.text,
        speaker=speaker,
        flags=flags,
        comment_count=comment_count,
    )


def get_segment(db: Session, meeting: Meeting, segment_id: int) -> TranscriptSegment:
    segment = db.get(TranscriptSegment, segment_id)
    if segment is None or segment.meeting_id != meeting.id:
        raise NotFoundError(f"Segment {segment_id} not found in this meeting")
    return segment


def update_segment(db: Session, meeting: Meeting, segment_id: int, data: SegmentUpdate) -> SegmentOut:
    segment = get_segment(db, meeting, segment_id)
    if data.text is not None:
        segment.text = " ".join(data.text.split())
    if "speaker_participant_id" in data.model_fields_set and data.speaker_participant_id is not None:
        if not any(p.id == data.speaker_participant_id for p in meeting.participants):
            raise InvalidInputError("The speaker must be a participant of this meeting.")
        segment.speaker_id = data.speaker_participant_id
    db.commit()
    db.refresh(segment)
    comments = db.scalar(select(func.count(Comment.id)).where(Comment.segment_id == segment.id)) or 0
    is_task = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.segment_id == segment.id)) or 0
    return _segment_out(segment, comments, bool(is_task))


# ── Comments ─────────────────────────────────────────────────────────────────


def _comment_out(comment: Comment) -> CommentOut:
    return CommentOut.model_validate(comment).model_copy(update={"start_ms": comment.segment.start_ms})


def list_comments(db: Session, meeting: Meeting) -> list[CommentOut]:
    comments = db.scalars(
        select(Comment)
        .join(TranscriptSegment)
        .where(TranscriptSegment.meeting_id == meeting.id)
        .options(joinedload(Comment.segment))
        .order_by(TranscriptSegment.start_ms, Comment.id)
    ).unique()
    return [_comment_out(c) for c in comments]


def add_comment(db: Session, meeting: Meeting, author: User, data: CommentCreate) -> CommentOut:
    segment = get_segment(db, meeting, data.segment_id)
    comment = Comment(segment_id=segment.id, author_id=author.id, body=data.body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_out(comment)


def delete_comment(db: Session, comment_id: int) -> None:
    comment = db.get(Comment, comment_id)
    if comment is None:
        raise NotFoundError(f"Comment {comment_id} not found")
    db.delete(comment)
    db.commit()


# ── Soundbites ───────────────────────────────────────────────────────────────


def add_soundbite(db: Session, meeting: Meeting, author: User, data: SoundbiteCreate) -> Soundbite:
    limit_ms = meeting.duration_seconds * 1000
    if limit_ms and data.start_ms >= limit_ms:
        raise InvalidInputError("The soundbite starts after the end of the recording.")
    soundbite = Soundbite(
        meeting_id=meeting.id,
        title=data.title.strip(),
        start_ms=data.start_ms,
        end_ms=min(data.end_ms, limit_ms) if limit_ms else data.end_ms,
        created_by_id=author.id,
    )
    db.add(soundbite)
    db.commit()
    db.refresh(soundbite)
    return soundbite


def delete_soundbite(db: Session, soundbite_id: int) -> None:
    soundbite = db.get(Soundbite, soundbite_id)
    if soundbite is None:
        raise NotFoundError(f"Soundbite {soundbite_id} not found")
    db.delete(soundbite)
    db.commit()
