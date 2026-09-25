"""Thin wrapper around the Anthropic SDK. Everything LLM-powered is optional:
callers catch ``LLMUnavailable`` and fall back to the offline implementations."""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any

import anthropic

from app.config import get_settings

log = logging.getLogger(__name__)


class LLMUnavailable(RuntimeError):
    """No API key configured, or the request failed / was declined."""


def llm_enabled() -> bool:
    return get_settings().llm_enabled


@lru_cache
def _client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=get_settings().anthropic_api_key, timeout=120.0, max_retries=2)


def _model_params(model: str, effort: str) -> dict[str, Any]:
    params: dict[str, Any] = {}
    if not model.startswith("claude-haiku"):
        params["output_config"] = {"effort": effort}
    # Server-side refusal fallbacks are available for the Opus 5 / Fable families.
    if model.startswith(("claude-opus-5", "claude-fable")):
        params["betas"] = ["server-side-fallback-2026-07-01"]
        params["fallbacks"] = "default"
    return params


def complete(
    *,
    system: str | list[dict[str, Any]],
    messages: list[dict[str, Any]],
    json_schema: dict[str, Any] | None = None,
    max_tokens: int = 16000,
    effort: str = "medium",
) -> str:
    """Run one Messages API call and return the concatenated text output."""
    settings = get_settings()
    if not settings.llm_enabled:
        raise LLMUnavailable("ANTHROPIC_API_KEY is not configured.")

    params = _model_params(settings.llm_model, effort)
    if json_schema is not None:
        params.setdefault("output_config", {})["format"] = {"type": "json_schema", "schema": json_schema}

    try:
        response = _client().beta.messages.create(
            model=settings.llm_model,
            max_tokens=max_tokens,
            system=system,
            messages=messages,
            **params,
        )
    except anthropic.AuthenticationError as exc:
        raise LLMUnavailable("The configured Anthropic API key was rejected.") from exc
    except anthropic.RateLimitError as exc:
        raise LLMUnavailable("The AI service is rate limited, try again shortly.") from exc
    except anthropic.APIStatusError as exc:
        log.warning("Anthropic API error %s: %s", exc.status_code, exc.message)
        raise LLMUnavailable(f"AI service error ({exc.status_code}).") from exc
    except anthropic.APIConnectionError as exc:
        raise LLMUnavailable("Could not reach the AI service.") from exc

    if response.stop_reason == "refusal":
        raise LLMUnavailable("The model declined this request.")
    if response.stop_reason == "max_tokens":
        raise LLMUnavailable("The AI response was cut off before it finished.")
    return "".join(block.text for block in response.content if block.type == "text").strip()


def complete_json(**kwargs: Any) -> dict[str, Any]:
    raw = complete(**kwargs)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMUnavailable("The AI returned malformed JSON.") from exc
    if not isinstance(data, dict):
        raise LLMUnavailable("The AI returned an unexpected JSON shape.")
    return data
