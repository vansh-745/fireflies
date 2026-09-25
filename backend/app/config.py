"""Runtime configuration, read once from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_dotenv(path: Path) -> None:
    """Minimal .env support: KEY=VALUE lines; real environment variables win."""
    if not path.is_file():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_dotenv(BASE_DIR / ".env")


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip() for item in raw.split(",") if item.strip()]


ON_VERCEL = bool(os.getenv("VERCEL"))


def _database_url() -> str:
    """Pick the database, in order: DATABASE_URL, Turso, /tmp on Vercel, a local file."""
    if url := os.getenv("DATABASE_URL"):
        return url
    if turso := os.getenv("TURSO_DATABASE_URL"):
        # Turso hands out libsql://<db>.turso.io; SQLAlchemy wants sqlite+libsql://<host>?secure=true
        host = turso.split("://", 1)[-1].rstrip("/")
        return f"sqlite+libsql://{host}?secure=true"
    if ON_VERCEL:
        # The only writable path on Vercel; it's per instance and reset on cold start.
        return "sqlite:////tmp/fireflies.db"
    return f"sqlite:///{BASE_DIR / 'fireflies.db'}"


@dataclass(frozen=True)
class Settings:
    database_url: str = field(default_factory=_database_url)
    database_auth_token: str | None = field(default_factory=lambda: os.getenv("TURSO_AUTH_TOKEN") or None)
    cors_origins: list[str] = field(
        default_factory=lambda: _list("CORS_ORIGINS", ["http://localhost:3000", "http://127.0.0.1:3000"])
    )
    # Seed demo data when the database has no meetings (handy on hosts with ephemeral disks).
    seed_on_startup: bool = field(default_factory=lambda: _bool("SEED_ON_STARTUP", True))
    # LLM features switch on automatically when an Anthropic API key is present.
    anthropic_api_key: str | None = field(default_factory=lambda: os.getenv("ANTHROPIC_API_KEY") or None)
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "claude-opus-5"))
    # Serverless hosts may freeze an instance once the response is sent, so run Claude inline there.
    run_ai_inline: bool = field(default_factory=lambda: _bool("RUN_AI_INLINE", ON_VERCEL))
    max_upload_bytes: int = field(default_factory=lambda: int(os.getenv("MAX_UPLOAD_BYTES", str(2 * 1024 * 1024))))

    @property
    def llm_enabled(self) -> bool:
        return self.anthropic_api_key is not None


@lru_cache
def get_settings() -> Settings:
    return Settings()
