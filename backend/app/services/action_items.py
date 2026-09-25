"""Action item CRUD (per meeting and across the workspace)."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.errors import InvalidInputError, NotFoundError
from app.models import ActionItem, ActionItemSource, Meeting, TranscriptSegment, utcnow
from app.schemas import ActionItemCreate, ActionItemOut, ActionItemUpdate, ActionItemWithMeeting
from app.schemas.action_items import MeetingRef
from app.services.meetings import action_item_out


def _get(db: Session, item_id: int) -> ActionItem:
    item = db.get(ActionItem, item_id)
    if item is None:
        raise NotFoundError(f"Action item {item_id} not found")
    return item


def _check_assignee(meeting: Meeting, assignee_id: int | None) -> None:
    if assignee_id is not None and not any(p.person_id == assignee_id for p in meeting.participants):
        raise InvalidInputError("Action items can only be assigned to meeting participants.")


def create_action_item(db: Session, meeting: Meeting, data: ActionItemCreate) -> ActionItemOut:
    _check_assignee(meeting, data.assignee_id)
    if data.segment_id is not None:
        segment = db.get(TranscriptSegment, data.segment_id)
        if segment is None or segment.meeting_id != meeting.id:
            raise InvalidInputError("The linked transcript segment does not belong to this meeting.")
    position = (db.scalar(select(func.max(ActionItem.position)).where(ActionItem.meeting_id == meeting.id)) or 0) + 1
    item = ActionItem(
        meeting_id=meeting.id,
        text=data.text.strip(),
        assignee_id=data.assignee_id,
        due_date=data.due_date,
        segment_id=data.segment_id,
        source=ActionItemSource.MANUAL,
        position=position,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return action_item_out(item)


def update_action_item(db: Session, item_id: int, data: ActionItemUpdate) -> ActionItemOut:
    item = _get(db, item_id)
    fields = data.model_fields_set
    if "text" in fields and data.text:
        item.text = data.text.strip()
    if "assignee_id" in fields:
        _check_assignee(item.meeting, data.assignee_id)
        item.assignee_id = data.assignee_id
    if "due_date" in fields:
        item.due_date = data.due_date
    if "is_completed" in fields and data.is_completed is not None and data.is_completed != item.is_completed:
        item.is_completed = data.is_completed
        item.completed_at = utcnow() if data.is_completed else None
    db.commit()
    db.refresh(item)
    return action_item_out(item)


def delete_action_item(db: Session, item_id: int) -> None:
    db.delete(_get(db, item_id))
    db.commit()


def list_all_action_items(
    db: Session, *, completed: bool | None, assignee_id: int | None, limit: int
) -> list[ActionItemWithMeeting]:
    stmt = (
        select(ActionItem)
        .join(Meeting)
        .options(joinedload(ActionItem.meeting), joinedload(ActionItem.segment))
        .order_by(ActionItem.is_completed, Meeting.started_at.desc(), ActionItem.position)
        .limit(limit)
    )
    if completed is not None:
        stmt = stmt.where(ActionItem.is_completed.is_(completed))
    if assignee_id is not None:
        stmt = stmt.where(ActionItem.assignee_id == assignee_id)
    items = db.scalars(stmt).unique()
    return [
        ActionItemWithMeeting(
            **action_item_out(i).model_dump(),
            meeting=MeetingRef(id=i.meeting.id, title=i.meeting.title, started_at=i.meeting.started_at),
        )
        for i in items
    ]
