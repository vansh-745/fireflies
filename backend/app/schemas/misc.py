from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.models import ChatRole
from app.schemas.common import ORMModel


class UserOut(ORMModel):
    id: int
    name: str
    email: str
    job_title: str | None


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    email: EmailStr | None = None
    job_title: str | None = Field(default=None, max_length=120)


class SoundbiteOut(ORMModel):
    id: int
    meeting_id: int
    title: str
    start_ms: int
    end_ms: int
    created_at: datetime


class SoundbiteCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    start_ms: int = Field(ge=0)
    end_ms: int = Field(gt=0)

    @model_validator(mode="after")
    def _range(self) -> SoundbiteCreate:
        if self.end_ms <= self.start_ms:
            raise ValueError("end_ms must be after start_ms")
        return self


class ChatMessageOut(ORMModel):
    id: int
    role: ChatRole
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class ChatAnswer(BaseModel):
    question: ChatMessageOut
    answer: ChatMessageOut
    powered_by: str  # "llm" | "offline"


class SearchHit(BaseModel):
    segment_id: int
    start_ms: int
    speaker: str | None
    snippet: str  # contains <mark>…</mark> around matched terms


class SearchResultMeeting(BaseModel):
    meeting_id: int
    title: str
    started_at: datetime
    duration_seconds: int
    title_match: bool
    hits: list[SearchHit]
    total_hits: int


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultMeeting]
    total_meetings: int


class NotificationOut(ORMModel):
    id: int
    kind: str
    title: str
    body: str
    meeting_id: int | None
    is_read: bool
    created_at: datetime


class StatsOut(BaseModel):
    meetings_total: int
    meetings_this_week: int
    minutes_total: int
    minutes_this_week: int
    open_action_items: int
    completed_action_items: int
    people_total: int
