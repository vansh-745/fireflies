"""AskFred — chat about one meeting."""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import DB, MeetingDep
from app.schemas import ChatAnswer, ChatMessageOut, ChatRequest
from app.services import chat as service

router = APIRouter(prefix="/meetings/{meeting_id}/chat", tags=["askfred"])


@router.get("", response_model=list[ChatMessageOut])
def get_history(meeting: MeetingDep, db: DB) -> list[ChatMessageOut]:
    return [ChatMessageOut.model_validate(m) for m in service.history(db, meeting)]


@router.post("", response_model=ChatAnswer)
def ask(meeting: MeetingDep, data: ChatRequest, db: DB) -> ChatAnswer:
    question, answer, powered_by = service.ask(db, meeting, data.question)
    return ChatAnswer(
        question=ChatMessageOut.model_validate(question),
        answer=ChatMessageOut.model_validate(answer),
        powered_by=powered_by,
    )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def clear_history(meeting: MeetingDep, db: DB) -> Response:
    service.clear_history(db, meeting)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
