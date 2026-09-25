"""Workspace-wide endpoints: profile, people, tags, search, stats, notifications."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import func, select, update

from app.api.deps import DB, CurrentUser
from app.models import Notification, User
from app.schemas import NotificationOut, PersonWithCount, SearchResponse, StatsOut, TagWithCount, UserOut, UserUpdate
from app.services import directory, llm, search, stats

router = APIRouter(tags=["workspace"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "llm_available": llm.llm_enabled()}


@router.get("/me", response_model=UserOut)
def get_me(user: CurrentUser) -> UserOut:
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: CurrentUser, db: DB) -> UserOut:
    if data.email and data.email.lower() != user.email.lower():
        taken = db.scalar(select(User.id).where(func.lower(User.email) == data.email.lower(), User.id != user.id))
        if taken:
            raise HTTPException(status.HTTP_409_CONFLICT, "That email is already in use.")
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field != "job_title" and value is None:
            continue
        setattr(user, field, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.get("/people", response_model=list[PersonWithCount])
def list_people(db: DB, q: Annotated[str | None, Query(max_length=100)] = None) -> list[PersonWithCount]:
    return [
        PersonWithCount(id=p.id, name=p.name, email=p.email, meeting_count=n) for p, n in directory.list_people(db, q)
    ]


@router.get("/tags", response_model=list[TagWithCount])
def list_tags(db: DB) -> list[TagWithCount]:
    return [TagWithCount(id=t.id, name=t.name, color=t.color, meeting_count=n) for t, n in directory.list_tags(db)]


@router.get("/search", response_model=SearchResponse)
def global_search(db: DB, q: Annotated[str, Query(min_length=1, max_length=200)]) -> SearchResponse:
    """Search every transcript (full-text, stemmed) and meeting title."""
    return search.search(db, q)


@router.get("/stats", response_model=StatsOut)
def workspace_stats(db: DB) -> StatsOut:
    return stats.workspace_stats(db)


@router.get("/notifications", response_model=list[NotificationOut])
def list_notifications(user: CurrentUser, db: DB, limit: Annotated[int, Query(ge=1, le=100)] = 20) -> list[NotificationOut]:
    rows = db.scalars(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.id.desc()).limit(limit)
    )
    return [NotificationOut.model_validate(n) for n in rows]


@router.post("/notifications/read-all", status_code=status.HTTP_204_NO_CONTENT)
def mark_all_read(user: CurrentUser, db: DB) -> None:
    db.execute(update(Notification).where(Notification.user_id == user.id).values(is_read=True))
    db.commit()
