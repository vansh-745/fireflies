"""People, tags and the default user — the shared "directory" entities."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Meeting, MeetingParticipant, Person, Tag, User, meeting_tags

DEFAULT_USER = {"name": "Alex Rivera", "email": "alex.rivera@orbit.example", "job_title": "Head of Product"}
TAG_COLORS = ("violet", "blue", "emerald", "amber", "rose", "cyan", "orange", "fuchsia")


def get_current_user(db: Session) -> User:
    """Authentication is out of scope: the first user is always "logged in"."""
    user = db.scalar(select(User).order_by(User.id).limit(1))
    if user is None:
        user = User(**DEFAULT_USER)
        db.add(user)
        db.flush()
    return user


def find_or_create_person(db: Session, name: str, email: str | None = None) -> Person:
    """Match by email first, then by (case-insensitive) name; otherwise create."""
    name = " ".join(name.split())
    email = email.strip().lower() if email else None

    if email:
        person = db.scalar(select(Person).where(func.lower(Person.email) == email))
        if person is not None:
            return person

    person = db.scalar(select(Person).where(func.lower(Person.name) == name.lower()).order_by(Person.id).limit(1))
    if person is not None:
        if email and person.email is None:
            person.email = email
        if person.email is None or email is None or person.email == email:
            return person

    person = Person(name=name, email=email)
    db.add(person)
    db.flush()
    return person


def find_or_create_tags(db: Session, names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    seen: set[str] = set()
    for raw in names:
        name = " ".join(raw.split())[:50]
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        tag = db.scalar(select(Tag).where(func.lower(Tag.name) == name.lower()))
        if tag is None:
            color = TAG_COLORS[sum(map(ord, name.lower())) % len(TAG_COLORS)]
            tag = Tag(name=name, color=color)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def list_people(db: Session, q: str | None = None, limit: int = 50) -> list[tuple[Person, int]]:
    """People with the number of meetings they attended, most active first."""
    count = func.count(MeetingParticipant.id).label("meeting_count")
    stmt = (
        select(Person, count)
        .join(MeetingParticipant, MeetingParticipant.person_id == Person.id)
        .group_by(Person.id)
        .order_by(count.desc(), Person.name)
        .limit(limit)
    )
    if q:
        stmt = stmt.where(Person.name.ilike(f"%{q}%") | Person.email.ilike(f"%{q}%"))
    return [(person, n) for person, n in db.execute(stmt).all()]


def list_tags(db: Session) -> list[tuple[Tag, int]]:
    count = func.count(meeting_tags.c.meeting_id).label("meeting_count")
    stmt = (
        select(Tag, count)
        .outerjoin(meeting_tags, meeting_tags.c.tag_id == Tag.id)
        .outerjoin(Meeting, Meeting.id == meeting_tags.c.meeting_id)
        .group_by(Tag.id)
        .order_by(count.desc(), Tag.name)
    )
    return [(tag, n) for tag, n in db.execute(stmt).all()]
