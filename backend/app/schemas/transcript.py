from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class SpeakerRef(BaseModel):
    participant_id: int
    person_id: int
    name: str


class SegmentOut(BaseModel):
    id: int
    position: int
    start_ms: int
    end_ms: int
    text: str
    speaker: SpeakerRef | None
    # Smart Search filters that match this segment: question / metric / date / task.
    flags: list[str]
    comment_count: int


class SegmentUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=10_000)
    speaker_participant_id: int | None = None


class CommentAuthor(ORMModel):
    id: int
    name: str


class CommentOut(ORMModel):
    id: int
    segment_id: int
    body: str
    author: CommentAuthor
    created_at: datetime
    start_ms: int = 0


class CommentCreate(BaseModel):
    segment_id: int
    body: str = Field(min_length=1, max_length=2000)
