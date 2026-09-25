"""Action items: per meeting, and a workspace-wide task list."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response, status

from app.api.deps import DB, MeetingDep
from app.schemas import ActionItemCreate, ActionItemOut, ActionItemUpdate, ActionItemWithMeeting
from app.services import action_items as service

router = APIRouter(tags=["action items"])


@router.get("/action-items", response_model=list[ActionItemWithMeeting])
def list_action_items(
    db: DB,
    completed: bool | None = None,
    assignee_id: int | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[ActionItemWithMeeting]:
    return service.list_all_action_items(db, completed=completed, assignee_id=assignee_id, limit=limit)


@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItemOut, status_code=status.HTTP_201_CREATED)
def create_action_item(meeting: MeetingDep, data: ActionItemCreate, db: DB) -> ActionItemOut:
    return service.create_action_item(db, meeting, data)


@router.patch("/action-items/{item_id}", response_model=ActionItemOut)
def update_action_item(item_id: int, data: ActionItemUpdate, db: DB) -> ActionItemOut:
    return service.update_action_item(db, item_id, data)


@router.delete("/action-items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_action_item(item_id: int, db: DB) -> Response:
    service.delete_action_item(db, item_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
