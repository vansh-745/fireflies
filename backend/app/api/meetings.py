"""/api/meetings — library listing, CRUD, uploads, AI notes and exports."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, Response, UploadFile, status
from pydantic import ValidationError

from app.api.deps import DB, CurrentUser, MeetingDep
from app.config import get_settings
from app.models import MeetingSource, Platform, Summary, SummaryStatus
from app.schemas import MeetingCreate, MeetingDetail, MeetingListItem, MeetingUpdate, Page, ParticipantIn, SummaryOut, SummaryUpdate
from app.services import export as export_service
from app.services import llm
from app.services import meetings as service
from app.services.transcript_parser import TranscriptParseError, parse_transcript

router = APIRouter(prefix="/meetings", tags=["meetings"])


def _schedule_llm_notes(background: BackgroundTasks, meeting_id: int) -> None:
    """Upgrade the offline notes with Claude: after the response, or inline on serverless hosts."""
    if not llm.llm_enabled():
        return
    if get_settings().run_ai_inline:
        service.enhance_summary_in_background(meeting_id)
    else:
        background.add_task(service.enhance_summary_in_background, meeting_id)


@router.get("", response_model=Page[MeetingListItem])
def list_meetings(
    db: DB,
    q: Annotated[str | None, Query(max_length=200, description="Matches title or participant name")] = None,
    person_id: Annotated[list[int] | None, Query(description="Only meetings with all of these people")] = None,
    tag_id: Annotated[list[int] | None, Query(description="Meetings with any of these tags")] = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort: service.SortOption = "newest",
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
) -> Page[MeetingListItem]:
    filters = service.MeetingFilters(
        q=q or None,
        person_ids=person_id,
        tag_ids=tag_id,
        date_from=service.ensure_aware(date_from),
        date_to=service.ensure_aware(date_to),
        sort=sort,
    )
    items, total = service.list_meetings(db, filters, page, page_size)
    return Page(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
def create_meeting(data: MeetingCreate, db: DB, user: CurrentUser, background: BackgroundTasks) -> MeetingDetail:
    """Create from a form; include ``transcript_text`` to paste a transcript."""
    segments = None
    if data.transcript_text and data.transcript_text.strip():
        try:
            segments = parse_transcript(data.transcript_text, data.transcript_format)
        except TranscriptParseError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    source = MeetingSource.PASTE if segments else MeetingSource.MANUAL
    meeting = service.create_meeting(db, user, data, source=source, segments=segments)
    if segments:
        _schedule_llm_notes(background, meeting.id)
    db.expire_all()
    return service.build_detail(db, service.get_meeting(db, meeting.id))


@router.post("/upload", response_model=MeetingDetail, status_code=status.HTTP_201_CREATED)
async def upload_meeting(
    db: DB,
    user: CurrentUser,
    background: BackgroundTasks,
    file: Annotated[UploadFile, File(description=".txt, .vtt, .srt or .json transcript")],
    title: Annotated[str | None, Form(max_length=255)] = None,
    started_at: Annotated[datetime | None, Form()] = None,
    participants: Annotated[str | None, Form(description="Comma-separated names")] = None,
    tags: Annotated[str | None, Form(description="Comma-separated tags")] = None,
    platform: Annotated[Platform, Form()] = Platform.UPLOAD,
) -> MeetingDetail:
    raw = await file.read(get_settings().max_upload_bytes + 1)
    if len(raw) > get_settings().max_upload_bytes:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Transcript files must be 2 MB or smaller.")
    try:
        segments = parse_transcript(raw.decode("utf-8", errors="replace"), filename=file.filename)
    except TranscriptParseError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc

    default_title = (file.filename or "Uploaded meeting").rsplit(".", 1)[0].replace("_", " ").replace("-", " ").strip()
    try:
        data = MeetingCreate(
            title=(title or "").strip() or default_title.title() or "Uploaded meeting",
            started_at=started_at,
            platform=platform,
            participants=[ParticipantIn(name=n) for n in (participants or "").split(",") if n.strip()],
            tags=[t for t in (tags or "").split(",") if t.strip()],
        )
    except ValidationError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, exc.errors(include_url=False)) from exc

    meeting = service.create_meeting(db, user, data, source=MeetingSource.UPLOAD, segments=segments)
    _schedule_llm_notes(background, meeting.id)
    db.expire_all()
    return service.build_detail(db, service.get_meeting(db, meeting.id))


@router.get("/{meeting_id}", response_model=MeetingDetail)
def get_meeting(meeting: MeetingDep, db: DB) -> MeetingDetail:
    return service.build_detail(db, meeting)


@router.patch("/{meeting_id}", response_model=MeetingDetail)
def update_meeting(meeting: MeetingDep, data: MeetingUpdate, db: DB) -> MeetingDetail:
    return service.build_detail(db, service.update_meeting(db, meeting, data))


@router.delete("/{meeting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meeting(meeting: MeetingDep, db: DB) -> Response:
    service.delete_meeting(db, meeting)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── AI notes ─────────────────────────────────────────────────────────────────


@router.post("/{meeting_id}/summary/regenerate", response_model=MeetingDetail)
def regenerate_summary(meeting: MeetingDep, db: DB, background: BackgroundTasks) -> MeetingDetail:
    """Rebuild summary, outline and (open, AI-suggested) action items from the transcript."""
    if service.regenerate_summary(db, meeting):
        _schedule_llm_notes(background, meeting.id)
    db.expire_all()
    return service.build_detail(db, service.get_meeting(db, meeting.id))


@router.patch("/{meeting_id}/summary", response_model=SummaryOut)
def edit_summary(meeting: MeetingDep, data: SummaryUpdate, db: DB) -> SummaryOut:
    summary = db.get(Summary, meeting.id)
    if summary is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This meeting has no summary yet.")
    if summary.status == SummaryStatus.PROCESSING:
        raise HTTPException(status.HTTP_409_CONFLICT, "AI notes are still being generated.")
    for field in data.model_fields_set:
        value = getattr(data, field)
        if value is not None:
            setattr(summary, field, [k.strip() for k in value if k.strip()] if field == "keywords" else value.strip())
    db.commit()
    db.refresh(summary)
    return SummaryOut.model_validate(summary)


# ── Export ───────────────────────────────────────────────────────────────────


@router.get("/{meeting_id}/export")
def export_meeting(
    meeting: MeetingDep,
    db: DB,
    format: export_service.ExportFormat = "md",  # noqa: A002 - public query parameter name
    content: export_service.ExportContent = "full",
) -> Response:
    body = export_service.render(export_service.load(db, meeting), format, content)
    return Response(
        content=body,
        media_type=export_service.MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{export_service.filename(meeting, format)}"'},
    )
