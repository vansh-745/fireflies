"""SQLAlchemy ORM models — the database schema.

Relationship overview (see README for the ER diagram):

    users 1─* meetings 1─* meeting_participants *─1 people
                  │ 1─* transcript_segments ─* comments
                  │ 1─1 summaries
                  │ 1─* chapters
                  │ 1─* action_items (assignee → people, source moment → transcript_segments)
                  │ *─* tags (via meeting_tags)
                  │ 1─* soundbites
                  └ 1─* chat_messages
    users 1─* notifications
"""

from __future__ import annotations

import enum
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator[datetime]):
    """Stores naive UTC (SQLite has no tz support) and always returns aware UTC datetimes."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Any) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Any) -> datetime | None:
        return value.replace(tzinfo=timezone.utc) if value is not None else None


def str_enum(enum_cls: type[enum.Enum]) -> Enum:
    """Store enums as their string value with a CHECK constraint (portable, readable in SQL)."""
    return Enum(
        enum_cls,
        native_enum=False,
        create_constraint=True,
        length=24,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )


# ── Enums ────────────────────────────────────────────────────────────────────


class Platform(enum.StrEnum):
    ZOOM = "zoom"
    GOOGLE_MEET = "google_meet"
    TEAMS = "teams"
    UPLOAD = "upload"


class MeetingSource(enum.StrEnum):
    SEED = "seed"
    UPLOAD = "upload"
    PASTE = "paste"
    MANUAL = "manual"


class ParticipantRole(enum.StrEnum):
    HOST = "host"
    ATTENDEE = "attendee"


class SummarySource(enum.StrEnum):
    SEED = "seed"
    HEURISTIC = "heuristic"
    LLM = "llm"


class SummaryStatus(enum.StrEnum):
    READY = "ready"
    # Offline notes are shown while Claude writes the full notes in the background.
    PROCESSING = "processing"


class ActionItemSource(enum.StrEnum):
    AI = "ai"
    MANUAL = "manual"


class ChatRole(enum.StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


# ── Association tables ───────────────────────────────────────────────────────

meeting_tags = Table(
    "meeting_tags",
    Base.metadata,
    Column("meeting_id", ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True, index=True),
)


# ── Core entities ────────────────────────────────────────────────────────────


class User(Base):
    """An account in the workspace. Auth is out of scope, so there is a single default user."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True)
    job_title: Mapped[str | None] = mapped_column(String(120))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Person(Base):
    """Anyone who shows up in meetings (colleagues, customers). Shared across meetings."""

    __tablename__ = "people"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    participations: Mapped[list[MeetingParticipant]] = relationship(back_populates="person")


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (CheckConstraint("duration_seconds >= 0", name="ck_meetings_duration_non_negative"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, index=True)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    platform: Mapped[Platform] = mapped_column(str_enum(Platform), default=Platform.UPLOAD)
    source: Mapped[MeetingSource] = mapped_column(str_enum(MeetingSource), default=MeetingSource.MANUAL)
    media_url: Mapped[str | None] = mapped_column(String(1024))
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    owner: Mapped[User] = relationship()
    participants: Mapped[list[MeetingParticipant]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="MeetingParticipant.id",
    )
    segments: Mapped[list[TranscriptSegment]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TranscriptSegment.position",
    )
    summary: Mapped[Summary | None] = relationship(
        back_populates="meeting", cascade="all, delete-orphan", passive_deletes=True
    )
    chapters: Mapped[list[Chapter]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Chapter.position",
    )
    action_items: Mapped[list[ActionItem]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ActionItem.position",
    )
    tags: Mapped[list[Tag]] = relationship(secondary=meeting_tags, back_populates="meetings", order_by="Tag.name")
    soundbites: Mapped[list[Soundbite]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Soundbite.start_ms",
    )
    chat_messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="meeting",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ChatMessage.id",
    )


class MeetingParticipant(Base):
    """A person's attendance in one meeting. Transcript speakers point here."""

    __tablename__ = "meeting_participants"
    __table_args__ = (UniqueConstraint("meeting_id", "person_id", name="uq_participant_meeting_person"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("people.id", ondelete="CASCADE"), index=True)
    role: Mapped[ParticipantRole] = mapped_column(str_enum(ParticipantRole), default=ParticipantRole.ATTENDEE)

    meeting: Mapped[Meeting] = relationship(back_populates="participants")
    person: Mapped[Person] = relationship(back_populates="participations", lazy="joined")


class TranscriptSegment(Base):
    """One utterance: a speaker, a time range and what they said."""

    __tablename__ = "transcript_segments"
    __table_args__ = (
        UniqueConstraint("meeting_id", "position", name="uq_segment_meeting_position"),
        CheckConstraint("end_ms >= start_ms", name="ck_segment_time_range"),
        Index("ix_segment_meeting_start", "meeting_id", "start_ms"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    speaker_id: Mapped[int | None] = mapped_column(
        ForeignKey("meeting_participants.id", ondelete="SET NULL"), index=True
    )
    position: Mapped[int] = mapped_column(Integer)
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    text: Mapped[str] = mapped_column(Text)

    meeting: Mapped[Meeting] = relationship(back_populates="segments")
    speaker: Mapped[MeetingParticipant | None] = relationship()
    comments: Mapped[list[Comment]] = relationship(
        back_populates="segment",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Comment.id",
    )


class Summary(Base):
    """AI notes for a meeting (1:1). Keywords are an ordered list, stored as JSON."""

    __tablename__ = "summaries"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), primary_key=True)
    gist: Mapped[str] = mapped_column(String(300), default="")
    overview: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[list[str]] = mapped_column(JSON, default=list)
    generated_by: Mapped[SummarySource] = mapped_column(str_enum(SummarySource))
    status: Mapped[SummaryStatus] = mapped_column(str_enum(SummaryStatus), default=SummaryStatus.READY)
    model: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="summary")


class Chapter(Base):
    """A section of the meeting outline, anchored to a point in the recording."""

    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("meeting_id", "position", name="uq_chapter_meeting_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    title: Mapped[str] = mapped_column(String(200))
    start_ms: Mapped[int] = mapped_column(Integer)
    bullets: Mapped[list[str]] = mapped_column(JSON, default=list)

    meeting: Mapped[Meeting] = relationship(back_populates="chapters")


class ActionItem(Base):
    __tablename__ = "action_items"
    __table_args__ = (Index("ix_action_item_meeting_position", "meeting_id", "position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(String(500))
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("people.id", ondelete="SET NULL"), index=True)
    due_date: Mapped[date | None] = mapped_column(Date)
    is_completed: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)
    source: Mapped[ActionItemSource] = mapped_column(str_enum(ActionItemSource), default=ActionItemSource.MANUAL)
    # The transcript moment the task was mentioned in (lets the UI jump to it).
    segment_id: Mapped[int | None] = mapped_column(ForeignKey("transcript_segments.id", ondelete="SET NULL"))
    position: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow, onupdate=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="action_items")
    assignee: Mapped[Person | None] = relationship(lazy="joined")
    segment: Mapped[TranscriptSegment | None] = relationship()


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50, collation="NOCASE"), unique=True)
    color: Mapped[str] = mapped_column(String(20), default="violet")

    meetings: Mapped[list[Meeting]] = relationship(secondary=meeting_tags, back_populates="tags")


class Soundbite(Base):
    """A saved clip (time range) of a meeting."""

    __tablename__ = "soundbites"
    __table_args__ = (CheckConstraint("end_ms > start_ms", name="ck_soundbite_time_range"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    start_ms: Mapped[int] = mapped_column(Integer)
    end_ms: Mapped[int] = mapped_column(Integer)
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="soundbites")
    created_by: Mapped[User] = relationship()


class Comment(Base):
    """A comment pinned to one transcript segment."""

    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    segment_id: Mapped[int] = mapped_column(ForeignKey("transcript_segments.id", ondelete="CASCADE"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    segment: Mapped[TranscriptSegment] = relationship(back_populates="comments")
    author: Mapped[User] = relationship(lazy="joined")


class ChatMessage(Base):
    """AskFred conversation history for a meeting."""

    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id", ondelete="CASCADE"), index=True)
    role: Mapped[ChatRole] = mapped_column(str_enum(ChatRole))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)

    meeting: Mapped[Meeting] = relationship(back_populates="chat_messages")


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(40))
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(String(500), default="")
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id", ondelete="SET NULL"))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
