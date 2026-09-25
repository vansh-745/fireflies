"""FastAPI application factory."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select

from app.api import action_items, chat, meetings, transcript, workspace
from app.config import get_settings
from app.database import SessionLocal, init_db
from app.errors import DomainError
from app.models import Meeting

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("app")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    init_db()
    if get_settings().seed_on_startup:
        with SessionLocal() as db:
            empty = not db.scalar(select(func.count(Meeting.id)))
        if empty:
            from app.seed.seed import seed_database

            log.info("Empty database — loading demo meetings")
            seed_database()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="Fireflies Clone API",
        version="1.0.0",
        description="Meetings, transcripts, AI notes, action items and search.",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    @app.exception_handler(DomainError)
    async def _domain_error(_: Request, exc: DomainError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    for module in (meetings, transcript, action_items, chat, workspace):
        app.include_router(module.router, prefix="/api")
    return app


app = create_app()
