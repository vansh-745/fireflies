from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.models import SummarySource, SummaryStatus
from app.schemas.common import ORMModel


class SummaryOut(ORMModel):
    gist: str
    overview: str
    keywords: list[str]
    generated_by: SummarySource
    status: SummaryStatus
    model: str | None
    updated_at: datetime


class ChapterOut(ORMModel):
    id: int
    position: int
    title: str
    start_ms: int
    bullets: list[str]


class SummaryUpdate(BaseModel):
    gist: str | None = Field(default=None, max_length=300)
    overview: str | None = Field(default=None, max_length=20_000)
    keywords: list[str] | None = Field(default=None, max_length=20)
