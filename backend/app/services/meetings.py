"""Meeting CRUD, AI-notes persistence and the read models built on top of them."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal

from sqlalchemy import Select, case, func, select
from sqlalchemy.orm import Session, selectinload

from app.database import SessionLocal
from app.errors import ConflictError, InvalidInputError, NotFoundError
from app.models import (
    ActionItem,
    ActionItemSource,
    Chapter,
    Comment,
    Meeting,
    MeetingParticipant,
    MeetingSource,
    Notification,
    ParticipantRole,
    Person,
    Soundbite,
    Summary,
    SummaryStatus,
    TranscriptSegment,
    User,
    meeting_tags,
    utcnow,
)
from app.schemas import (
    ActionItemOut,
    ChapterOut,
    MeetingCreate,
    MeetingDetail,
    MeetingListItem,
    MeetingUpdate,
    ParticipantIn,
    ParticipantOut,
    SpeakerStat,
    SummaryOut,
    TagOut,
)
from app.services import llm
from app.services.directory import find_or_create_person, find_or_create_tags
from app.services.summarizer import SegmentInput, SummaryDraft, generate_summary
from app.services.text_analysis import words
from app.services.transcript_parser import ParsedSegment

log = logging.getLogger(__name__)

SortOption = Literal["newest", "oldest", "longest", "shortest", "title"]


# ── Loading ──────────────────────────────────────────────────────────────────


def _with_list_relations(stmt: Select) -> Select:
    return stmt.options(
        selectinload(Meeting.participants).joinedload(MeetingParticipant.person),
        selectinload(Meeting.tags),
        selectinload(Meeting.summary),
    )


def get_meeting(db: Session, meeting_id: int) -> Meeting:
    meeting = db.scalar(_with_list_relations(select(Meeting).where(Meeting.id == meeting_id)))
    if meeting is None:
        raise NotFoundError(f"Meeting {meeting_id} not found")
    return meeting


# ── Listing ──────────────────────────────────────────────────────────────────


@dataclass
class MeetingFilters:
    q: str | None = None
    person_ids: list[int] | None = None
    tag_ids: list[int] | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
    sort: SortOption = "newest"


def list_meetings(db: Session, filters: MeetingFilters, page: int, page_size: int) -> tuple[list[MeetingListItem], int]:
    stmt = select(Meeting)
    if filters.q:
        term = f"%{filters.q.strip()}%"
        # Title, or anyone in the meeting whose name matches.
        participant_match = (
            select(MeetingParticipant.meeting_id)
            .join(Person, Person.id == MeetingParticipant.person_id)
            .where(Person.name.ilike(term))
        )
        stmt = stmt.where(Meeting.title.ilike(term) | Meeting.id.in_(participant_match))
    if filters.person_ids:
        # A meeting must include *every* selected person.
        for person_id in filters.person_ids:
            stmt = stmt.where(
                Meeting.id.in_(select(MeetingParticipant.meeting_id).where(MeetingParticipant.person_id == person_id))
            )
    if filters.tag_ids:
        stmt = stmt.where(Meeting.id.in_(select(meeting_tags.c.meeting_id).where(meeting_tags.c.tag_id.in_(filters.tag_ids))))
    if filters.date_from:
        stmt = stmt.where(Meeting.started_at >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(Meeting.started_at <= filters.date_to)

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0

    order = {
        "newest": [Meeting.started_at.desc()],
        "oldest": [Meeting.started_at.asc()],
        "longest": [Meeting.duration_seconds.desc(), Meeting.started_at.desc()],
        "shortest": [Meeting.duration_seconds.asc(), Meeting.started_at.desc()],
        "title": [func.lower(Meeting.title).asc()],
    }[filters.sort]
    stmt = _with_list_relations(stmt.order_by(*order, Meeting.id.desc()).offset((page - 1) * page_size).limit(page_size))
    meetings = list(db.scalars(stmt).unique())

    counts = _action_item_counts(db, [m.id for m in meetings])
    return [to_list_item(m, *counts.get(m.id, (0, 0))) for m in meetings], total


def _action_item_counts(db: Session, meeting_ids: list[int]) -> dict[int, tuple[int, int]]:
    if not meeting_ids:
        return {}
    rows = db.execute(
        select(
            ActionItem.meeting_id,
            func.count(ActionItem.id),
            func.sum(case((ActionItem.is_completed.is_(False), 1), else_=0)),
        )
        .where(ActionItem.meeting_id.in_(meeting_ids))
        .group_by(ActionItem.meeting_id)
    ).all()
    return {meeting_id: (total, int(open_ or 0)) for meeting_id, total, open_ in rows}


def participant_out(p: MeetingParticipant) -> ParticipantOut:
    return ParticipantOut(id=p.id, person_id=p.person_id, name=p.person.name, email=p.person.email, role=p.role)


def _base_fields(meeting: Meeting) -> dict:
    return {
        "id": meeting.id,
        "title": meeting.title,
        "started_at": meeting.started_at,
        "duration_seconds": meeting.duration_seconds,
        "platform": meeting.platform,
        "source": meeting.source,
        "participants": [participant_out(p) for p in _hosts_first(meeting.participants)],
        "tags": [TagOut.model_validate(t) for t in meeting.tags],
        "created_at": meeting.created_at,
        "updated_at": meeting.updated_at,
    }


def _hosts_first(participants: list[MeetingParticipant]) -> list[MeetingParticipant]:
    return sorted(participants, key=lambda p: (p.role != ParticipantRole.HOST, p.id))


def to_list_item(meeting: Meeting, action_total: int, action_open: int) -> MeetingListItem:
    return MeetingListItem(
        **_base_fields(meeting),
        gist=meeting.summary.gist if meeting.summary else None,
        keywords=meeting.summary.keywords if meeting.summary else [],
        action_items_total=action_total,
        action_items_open=action_open,
    )


# ── Detail ───────────────────────────────────────────────────────────────────


def action_item_out(item: ActionItem) -> ActionItemOut:
    return ActionItemOut.model_validate(item, from_attributes=True).model_copy(
        update={"start_ms": item.segment.start_ms if item.segment else None}
    )


def build_detail(db: Session, meeting: Meeting) -> MeetingDetail:
    segments = list(
        db.scalars(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.position))
    )
    comment_count = db.scalar(
        select(func.count(Comment.id)).join(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting.id)
    )
    soundbite_count = db.scalar(select(func.count(Soundbite.id)).where(Soundbite.meeting_id == meeting.id))
    action_items = list(
        db.scalars(
            select(ActionItem)
            .where(ActionItem.meeting_id == meeting.id)
            .options(selectinload(ActionItem.segment))
            .order_by(ActionItem.position, ActionItem.id)
        ).unique()
    )
    chapters = list(db.scalars(select(Chapter).where(Chapter.meeting_id == meeting.id).order_by(Chapter.position)))

    return MeetingDetail(
        **_base_fields(meeting),
        media_url=meeting.media_url,
        summary=SummaryOut.model_validate(meeting.summary) if meeting.summary else None,
        chapters=[ChapterOut.model_validate(c) for c in chapters],
        action_items=[action_item_out(a) for a in action_items],
        speaker_stats=speaker_stats(meeting, segments),
        segment_count=len(segments),
        comment_count=comment_count or 0,
        soundbite_count=soundbite_count or 0,
        llm_available=llm.llm_enabled(),
    )


def speaker_stats(meeting: Meeting, segments: list[TranscriptSegment]) -> list[SpeakerStat]:
    names = {p.id: p.person.name for p in meeting.participants}
    stats: dict[int | None, dict] = {}
    total_ms = 0
    previous_speaker: int | None | object = object()
    run_ms = 0

    for seg in segments:
        duration = max(0, seg.end_ms - seg.start_ms)
        total_ms += duration
        s = stats.setdefault(
            seg.speaker_id,
            {"talk": 0, "words": 0, "segments": 0, "questions": 0, "longest": 0},
        )
        s["talk"] += duration
        s["words"] += len(words(seg.text))
        s["segments"] += 1
        s["questions"] += seg.text.count("?")
        run_ms = run_ms + duration if seg.speaker_id == previous_speaker else duration
        s["longest"] = max(s["longest"], run_ms)
        previous_speaker = seg.speaker_id

    result = [
        SpeakerStat(
            participant_id=pid,
            name=names.get(pid, "Unknown speaker") if pid is not None else "Unknown speaker",
            talk_time_ms=s["talk"],
            talk_percent=round(100 * s["talk"] / total_ms, 1) if total_ms else 0.0,
            word_count=s["words"],
            words_per_minute=round(s["words"] / (s["talk"] / 60_000)) if s["talk"] else 0,
            segment_count=s["segments"],
            questions=s["questions"],
            longest_monologue_ms=s["longest"],
        )
        for pid, s in stats.items()
    ]
    return sorted(result, key=lambda r: -r.talk_time_ms)


# ── Create / update / delete ─────────────────────────────────────────────────


def _participant_key(name: str) -> str:
    return " ".join(name.lower().split())


def insert_meeting(
    db: Session,
    owner: User,
    data: MeetingCreate,
    *,
    source: MeetingSource,
    segments: list[ParsedSegment] | None = None,
) -> Meeting:
    """Insert a meeting with its participants, transcript and tags (no notes, no commit)."""
    segments = segments or []
    transcript_end_ms = max((s.end_ms or 0 for s in segments), default=0)
    duration = data.duration_seconds if data.duration_seconds is not None else round(transcript_end_ms / 1000)
    started_at = data.started_at or (utcnow() - timedelta(seconds=duration))

    meeting = Meeting(
        title=data.title.strip(),
        started_at=started_at,
        duration_seconds=duration,
        platform=data.platform,
        source=source,
        media_url=data.media_url or None,
        owner_id=owner.id,
    )
    db.add(meeting)
    db.flush()

    # Everyone listed on the form, plus every speaker found in the transcript.
    wanted: list[ParticipantIn] = list(data.participants)
    known = {_participant_key(p.name) for p in wanted}
    for seg in segments:
        if _participant_key(seg.speaker) not in known:
            known.add(_participant_key(seg.speaker))
            wanted.append(ParticipantIn(name=seg.speaker))
    if wanted and not any(p.role == ParticipantRole.HOST for p in wanted):
        wanted[0] = wanted[0].model_copy(update={"role": ParticipantRole.HOST})

    by_name: dict[str, MeetingParticipant] = {}
    for p in wanted:
        participant = _add_participant(db, meeting, p)
        by_name.setdefault(_participant_key(p.name), participant)

    for position, seg in enumerate(segments):
        speaker = by_name.get(_participant_key(seg.speaker))
        db.add(
            TranscriptSegment(
                meeting_id=meeting.id,
                speaker_id=speaker.id if speaker else None,
                position=position,
                start_ms=seg.start_ms or 0,
                end_ms=seg.end_ms or seg.start_ms or 0,
                text=seg.text,
            )
        )
    meeting.tags = find_or_create_tags(db, data.tags)
    db.flush()
    return meeting


def create_meeting(
    db: Session,
    owner: User,
    data: MeetingCreate,
    *,
    source: MeetingSource,
    segments: list[ParsedSegment] | None = None,
) -> Meeting:
    meeting = insert_meeting(db, owner, data, source=source, segments=segments)
    if segments:
        # Instant offline notes; Claude replaces them in the background when configured.
        participants = [p.person.name for p in meeting.participants]
        draft = generate_summary(meeting.title, segment_inputs(db, meeting), participants, use_llm=False)
        status = SummaryStatus.PROCESSING if llm.llm_enabled() else SummaryStatus.READY
        persist_summary(db, meeting, draft, status=status)

    notify(
        db,
        owner,
        kind="meeting_ready",
        title=f"“{meeting.title}” is ready",
        body="Transcript and AI notes are available." if segments else "Meeting created.",
        meeting_id=meeting.id,
    )
    db.commit()
    return get_meeting(db, meeting.id)


def _add_participant(db: Session, meeting: Meeting, p: ParticipantIn) -> MeetingParticipant:
    person = find_or_create_person(db, p.name, p.email)
    existing = next((mp for mp in meeting.participants if mp.person_id == person.id), None)
    if existing is not None:
        return existing
    participant = MeetingParticipant(meeting=meeting, person=person, role=p.role)
    db.add(participant)
    db.flush()
    return participant


def update_meeting(db: Session, meeting: Meeting, data: MeetingUpdate) -> Meeting:
    fields = data.model_fields_set
    if "title" in fields and data.title:
        meeting.title = data.title.strip()
    if "started_at" in fields and data.started_at:
        meeting.started_at = data.started_at
    if "platform" in fields and data.platform:
        meeting.platform = data.platform
    if "media_url" in fields:
        meeting.media_url = data.media_url or None
    if "tags" in fields and data.tags is not None:
        meeting.tags = find_or_create_tags(db, data.tags)
    if "participants" in fields and data.participants is not None:
        _sync_participants(db, meeting, data.participants)
    meeting.updated_at = utcnow()
    db.commit()
    return get_meeting(db, meeting.id)


def _sync_participants(db: Session, meeting: Meeting, desired: list[ParticipantIn]) -> None:
    keep_ids: set[int] = set()
    for p in desired:
        participant = _add_participant(db, meeting, p)
        participant.role = p.role
        keep_ids.add(participant.id)

    removed = [mp for mp in meeting.participants if mp.id not in keep_ids]
    if not removed:
        return
    speaking = set(
        db.scalars(
            select(TranscriptSegment.speaker_id).where(TranscriptSegment.speaker_id.in_([mp.id for mp in removed])).distinct()
        )
    )
    blocked = [mp.person.name for mp in removed if mp.id in speaking]
    if blocked:
        raise ConflictError(
            f"{', '.join(blocked)} speak{'s' if len(blocked) == 1 else ''} in the transcript and can't be removed."
        )
    for mp in removed:
        meeting.participants.remove(mp)
    if meeting.participants and not any(mp.role == ParticipantRole.HOST for mp in meeting.participants):
        meeting.participants[0].role = ParticipantRole.HOST


def delete_meeting(db: Session, meeting: Meeting) -> None:
    db.delete(meeting)
    db.commit()


# ── AI notes ─────────────────────────────────────────────────────────────────


def segment_inputs(db: Session, meeting: Meeting) -> list[SegmentInput]:
    rows = db.execute(
        select(TranscriptSegment, Person.name)
        .outerjoin(MeetingParticipant, MeetingParticipant.id == TranscriptSegment.speaker_id)
        .outerjoin(Person, Person.id == MeetingParticipant.person_id)
        .where(TranscriptSegment.meeting_id == meeting.id)
        .order_by(TranscriptSegment.position)
    ).all()
    return [SegmentInput(name or "Unknown speaker", seg.text, seg.start_ms, seg.end_ms) for seg, name in rows]


def persist_summary(db: Session, meeting: Meeting, draft: SummaryDraft, *, status: SummaryStatus = SummaryStatus.READY) -> None:
    """Store a draft: upsert the summary, replace chapters and refresh AI action items.

    Action items the user created, edited into completion, or ticked off are kept;
    only still-open AI suggestions are replaced.
    """
    summary = db.get(Summary, meeting.id)
    if summary is None:
        summary = Summary(meeting_id=meeting.id, generated_by=draft.source)
        db.add(summary)
    summary.gist = draft.gist
    summary.overview = draft.overview
    summary.keywords = draft.keywords
    summary.generated_by = draft.source
    summary.model = draft.model
    summary.status = status
    summary.updated_at = utcnow()

    for chapter in db.scalars(select(Chapter).where(Chapter.meeting_id == meeting.id)):
        db.delete(chapter)
    db.flush()
    for position, ch in enumerate(draft.chapters):
        db.add(Chapter(meeting_id=meeting.id, position=position, title=ch.title, start_ms=ch.start_ms, bullets=ch.bullets))

    existing = list(db.scalars(select(ActionItem).where(ActionItem.meeting_id == meeting.id)))
    for item in existing:
        if item.source == ActionItemSource.AI and not item.is_completed:
            db.delete(item)
    kept_texts = {i.text.lower() for i in existing if not (i.source == ActionItemSource.AI and not i.is_completed)}

    segment_ids = list(
        db.scalars(select(TranscriptSegment.id).where(TranscriptSegment.meeting_id == meeting.id).order_by(TranscriptSegment.position))
    )
    names = {_participant_key(p.person.name): p.person_id for p in meeting.participants}
    next_position = max((i.position for i in existing), default=-1) + 1
    for action in draft.action_items:
        if action.text.lower() in kept_texts:
            continue
        segment_index = action.segment_index
        db.add(
            ActionItem(
                meeting_id=meeting.id,
                text=action.text,
                assignee_id=names.get(_participant_key(action.assignee)) if action.assignee else None,
                source=ActionItemSource.AI,
                segment_id=segment_ids[segment_index] if segment_index is not None and segment_index < len(segment_ids) else None,
                position=next_position,
            )
        )
        next_position += 1
    db.flush()


def regenerate_summary(db: Session, meeting: Meeting) -> bool:
    """Regenerate the AI notes. Returns True when Claude will finish them in the background."""
    segments = segment_inputs(db, meeting)
    if not segments:
        raise InvalidInputError("This meeting has no transcript to summarize.")
    if llm.llm_enabled():
        if db.get(Summary, meeting.id) is None:
            draft = generate_summary(meeting.title, segments, [p.person.name for p in meeting.participants], use_llm=False)
            persist_summary(db, meeting, draft)
        summary = db.get(Summary, meeting.id)
        assert summary is not None
        summary.status = SummaryStatus.PROCESSING
        db.commit()
        return True
    draft = generate_summary(meeting.title, segments, [p.person.name for p in meeting.participants], use_llm=False)
    persist_summary(db, meeting, draft)
    db.commit()
    return False


def enhance_summary_in_background(meeting_id: int) -> None:
    """Background task: ask Claude for full notes and swap them in (own DB session)."""
    with SessionLocal() as db:
        meeting = db.get(Meeting, meeting_id)
        if meeting is None:
            return
        segments = segment_inputs(db, meeting)
        participants = [p.person.name for p in meeting.participants]
        draft = generate_summary(meeting.title, segments, participants, use_llm=True)
        if draft.notes:
            summary = db.get(Summary, meeting.id)
            if summary is not None and summary.status == SummaryStatus.PROCESSING:
                summary.status = SummaryStatus.READY
            owner = db.get(User, meeting.owner_id)
            if owner is not None:
                notify(db, owner, kind="summary_failed", title="AI notes could not be generated", body=draft.notes[0], meeting_id=meeting.id)
            db.commit()
            return
        persist_summary(db, meeting, draft, status=SummaryStatus.READY)
        owner = db.get(User, meeting.owner_id)
        if owner is not None:
            notify(db, owner, kind="summary_ready", title=f"AI notes ready for “{meeting.title}”", meeting_id=meeting.id)
        db.commit()


# ── Notifications ────────────────────────────────────────────────────────────


def notify(db: Session, user: User, *, kind: str, title: str, body: str = "", meeting_id: int | None = None) -> None:
    db.add(Notification(user_id=user.id, kind=kind, title=title[:200], body=body[:500], meeting_id=meeting_id))


def ensure_aware(value: datetime | None) -> datetime | None:
    if value is not None and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value

