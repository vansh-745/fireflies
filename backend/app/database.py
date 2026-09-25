"""Engine, session factory and schema bootstrap (tables + FTS5 index)."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _build_engine(url: str, auth_token: str | None) -> Engine:
    libsql = url.startswith("sqlite+libsql")  # Turso / libSQL (hosted SQLite)
    connect_args: dict = {}
    if libsql and auth_token:
        connect_args["auth_token"] = auth_token
    elif url.startswith("sqlite") and not libsql:
        connect_args["check_same_thread"] = False
    eng = create_engine(url, connect_args=connect_args, pool_pre_ping=libsql)

    if url.startswith("sqlite"):

        @event.listens_for(eng, "connect")
        def _sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001 - DB-API connection
            cursor = dbapi_conn.cursor()
            # SQLite ships with FK enforcement off; every relationship below relies on it.
            cursor.execute("PRAGMA foreign_keys=ON")
            if not libsql:
                cursor.execute("PRAGMA journal_mode=WAL")
            cursor.close()

    return eng


_settings = get_settings()
engine = _build_engine(_settings.database_url, _settings.database_auth_token)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Full-text index over transcript text. It is an "external content" FTS5 table:
# rows live in transcript_segments, and triggers keep the index in sync.
FTS_DDL = [
    """
    CREATE VIRTUAL TABLE IF NOT EXISTS transcript_segments_fts USING fts5(
        text,
        content='transcript_segments',
        content_rowid='id',
        tokenize='porter unicode61'
    )
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ai AFTER INSERT ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_ad AFTER DELETE ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(transcript_segments_fts, rowid, text)
        VALUES ('delete', old.id, old.text);
    END
    """,
    """
    CREATE TRIGGER IF NOT EXISTS transcript_segments_au AFTER UPDATE OF text ON transcript_segments BEGIN
        INSERT INTO transcript_segments_fts(transcript_segments_fts, rowid, text)
        VALUES ('delete', old.id, old.text);
        INSERT INTO transcript_segments_fts(rowid, text) VALUES (new.id, new.text);
    END
    """,
]


def init_db() -> None:
    """Create tables and the FTS index if they do not exist yet."""
    from app import models  # noqa: F401 - registers mappers on Base.metadata

    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        for statement in FTS_DDL:
            conn.execute(text(statement))
