from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models import ActionItemSource
from app.schemas.common import ORMModel


class AssigneeOut(ORMModel):
    id: int
    name: str
    email: str | None


class ActionItemOut(ORMModel):
    id: int
    meeting_id: int
    text: str
    assignee: AssigneeOut | None
    due_date: date | None
    is_completed: bool
    completed_at: datetime | None
    source: ActionItemSource
    segment_id: int | None
    start_ms: int | None = None
    created_at: datetime


class MeetingRef(BaseModel):
    id: int
    title: str
    started_at: datetime


class ActionItemWithMeeting(ActionItemOut):
    meeting: MeetingRef


class ActionItemCreate(BaseModel):
    text: str = Field(min_length=1, max_length=500)
    assignee_id: int | None = None
    due_date: date | None = None
    segment_id: int | None = None


class ActionItemUpdate(BaseModel):
    text: str | None = Field(default=None, min_length=1, max_length=500)
    assignee_id: int | None = None
    due_date: date | None = None
    is_completed: bool | None = None
