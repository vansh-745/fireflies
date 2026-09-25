"""Workspace-level numbers for the home dashboard."""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import ActionItem, Meeting, Person, utcnow
from app.schemas import StatsOut


def workspace_stats(db: Session) -> StatsOut:
    week_ago = utcnow() - timedelta(days=7)
    total, seconds = db.execute(select(func.count(Meeting.id), func.coalesce(func.sum(Meeting.duration_seconds), 0))).one()
    week_total, week_seconds = db.execute(
        select(func.count(Meeting.id), func.coalesce(func.sum(Meeting.duration_seconds), 0)).where(Meeting.started_at >= week_ago)
    ).one()
    open_items = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.is_completed.is_(False))) or 0
    done_items = db.scalar(select(func.count(ActionItem.id)).where(ActionItem.is_completed.is_(True))) or 0
    people = db.scalar(select(func.count(Person.id))) or 0
    return StatsOut(
        meetings_total=total,
        meetings_this_week=week_total,
        minutes_total=round(seconds / 60),
        minutes_this_week=round(week_seconds / 60),
        open_action_items=open_items,
        completed_action_items=done_items,
        people_total=people,
    )
