"""Shared FastAPI dependencies."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, Path
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Meeting, User
from app.services.directory import get_current_user
from app.services.meetings import get_meeting

DB = Annotated[Session, Depends(get_db)]


def _current_user(db: DB) -> User:
    return get_current_user(db)


def _meeting(db: DB, meeting_id: Annotated[int, Path(ge=1)]) -> Meeting:
    return get_meeting(db, meeting_id)


CurrentUser = Annotated[User, Depends(_current_user)]
MeetingDep = Annotated[Meeting, Depends(_meeting)]
