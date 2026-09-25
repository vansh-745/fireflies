"""Transcript segments, comments and soundbites of a meeting."""

from __future__ import annotations

from fastapi import APIRouter, Response, status

from app.api.deps import DB, CurrentUser, MeetingDep
from app.schemas import CommentCreate, CommentOut, SegmentOut, SegmentUpdate, SoundbiteCreate, SoundbiteOut
from app.services import transcript as service

router = APIRouter(tags=["transcript"])


@router.get("/meetings/{meeting_id}/transcript", response_model=list[SegmentOut])
def get_transcript(meeting: MeetingDep, db: DB) -> list[SegmentOut]:
    return service.list_segments(db, meeting)


@router.patch("/meetings/{meeting_id}/transcript/{segment_id}", response_model=SegmentOut)
def edit_segment(meeting: MeetingDep, segment_id: int, data: SegmentUpdate, db: DB) -> SegmentOut:
    """Fix a transcription error or re-assign the speaker of one segment."""
    return service.update_segment(db, meeting, segment_id, data)


@router.get("/meetings/{meeting_id}/comments", response_model=list[CommentOut])
def list_comments(meeting: MeetingDep, db: DB) -> list[CommentOut]:
    return service.list_comments(db, meeting)


@router.post("/meetings/{meeting_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(meeting: MeetingDep, data: CommentCreate, db: DB, user: CurrentUser) -> CommentOut:
    return service.add_comment(db, meeting, user, data)


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(comment_id: int, db: DB) -> Response:
    service.delete_comment(db, comment_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/meetings/{meeting_id}/soundbites", response_model=list[SoundbiteOut])
def list_soundbites(meeting: MeetingDep) -> list[SoundbiteOut]:
    return [SoundbiteOut.model_validate(s) for s in meeting.soundbites]


@router.post("/meetings/{meeting_id}/soundbites", response_model=SoundbiteOut, status_code=status.HTTP_201_CREATED)
def add_soundbite(meeting: MeetingDep, data: SoundbiteCreate, db: DB, user: CurrentUser) -> SoundbiteOut:
    return SoundbiteOut.model_validate(service.add_soundbite(db, meeting, user, data))


@router.delete("/soundbites/{soundbite_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_soundbite(soundbite_id: int, db: DB) -> Response:
    service.delete_soundbite(db, soundbite_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
