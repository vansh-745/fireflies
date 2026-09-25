from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import MeetingSource, ParticipantRole, Platform
from app.schemas.action_items import ActionItemOut
from app.schemas.common import ORMModel
from app.schemas.summary import ChapterOut, SummaryOut


class PersonOut(ORMModel):
    id: int
    name: str
    email: str | None


class PersonWithCount(PersonOut):
    meeting_count: int


class ParticipantOut(BaseModel):
    """A participant flattened with their person record, which is what the UI needs."""

    id: int
    person_id: int
    name: str
    email: str | None
    role: ParticipantRole


class ParticipantIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr | None = None
    role: ParticipantRole = ParticipantRole.ATTENDEE

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str) -> str:
        value = " ".join(value.split())
        if not value:
            raise ValueError("Name cannot be blank")
        return value


class TagOut(ORMModel):
    id: int
    name: str
    color: str


class TagWithCount(TagOut):
    meeting_count: int


class SpeakerStat(BaseModel):
    participant_id: int | None
    name: str
    talk_time_ms: int
    talk_percent: float
    word_count: int
    words_per_minute: int
    segment_count: int
    questions: int
    longest_monologue_ms: int


class MeetingBase(BaseModel):
    id: int
    title: str
    started_at: datetime
    duration_seconds: int
    platform: Platform
    source: MeetingSource
    participants: list[ParticipantOut]
    tags: list[TagOut]
    created_at: datetime
    updated_at: datetime


class MeetingListItem(MeetingBase):
    gist: str | None
    keywords: list[str]
    action_items_total: int
    action_items_open: int


class MeetingDetail(MeetingBase):
    media_url: str | None
    summary: SummaryOut | None
    chapters: list[ChapterOut]
    action_items: list[ActionItemOut]
    speaker_stats: list[SpeakerStat]
    segment_count: int
    comment_count: int
    soundbite_count: int
    llm_available: bool


class MeetingCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    started_at: datetime | None = None
    duration_seconds: int | None = Field(default=None, ge=0, le=24 * 3600)
    platform: Platform = Platform.UPLOAD
    participants: list[ParticipantIn] = Field(default_factory=list, max_length=100)
    tags: list[str] = Field(default_factory=list, max_length=20)
    media_url: str | None = Field(default=None, max_length=1024)
    # Optional transcript pasted into the form; parsed with the same rules as uploads.
    transcript_text: str | None = Field(default=None, max_length=1_000_000)
    transcript_format: str | None = None


class MeetingUpdate(BaseModel):
    """PATCH semantics: only fields that are sent are changed."""

    title: str | None = Field(default=None, min_length=1, max_length=255)
    started_at: datetime | None = None
    platform: Platform | None = None
    participants: list[ParticipantIn] | None = Field(default=None, max_length=100)
    tags: list[str] | None = Field(default=None, max_length=20)
    media_url: str | None = Field(default=None, max_length=1024)
