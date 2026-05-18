"""Shared API client for the DebateKit REST API."""

from __future__ import annotations

import os
from typing import TypedDict

import httpx

DEFAULT_BASE_URL = "https://mcp.debatekit.com/api/v1"
DEFAULT_TIMEOUT = 120.0

# API endpoint path constants — source of truth for all CrewAI tools
ENDPOINT_CONSULT = "/consult"
ENDPOINT_REVIEW_CODE = "/review-code"
ENDPOINT_DEBUG = "/debug"
ENDPOINT_ARCHITECT = "/architect"
ENDPOINT_PLAN_IMPLEMENTATION = "/plan-implementation"
ENDPOINT_ASSESS_TRADEOFFS = "/assess-tradeoffs"


# ---------------------------------------------------------------------------
# Response types — typed dicts for API responses
# ---------------------------------------------------------------------------

class ParticipantResult(TypedDict, total=False):
    """A single participant's response from the DebateKit API."""
    model_id: str
    model_name: str
    role: str
    response: str


class ModeratorResult(TypedDict, total=False):
    """The moderator summary from the DebateKit API."""
    summary: str


class DebateMetadata(TypedDict, total=False):
    """Metadata from a DebateKit debate endpoint."""
    duration_ms: int
    format: str
    mode: str
    thinking_level: str
    total_credits_used: float


class DebateResult(TypedDict, total=False):
    """Top-level response from a DebateKit debate endpoint."""
    metadata: DebateMetadata
    moderator: ModeratorResult
    participants: list[ParticipantResult]
    session_id: str


class ThreadLinkResult(TypedDict, total=False):
    """Response from the get-thread-link endpoint."""
    url: str
    public_url: str


class DebateKitClient:
    """Thin HTTP wrapper around the DebateKit REST API.

    The API key is resolved in order:
      1. Explicit ``api_key`` constructor argument.
      2. ``DEBATEKIT_API_KEY`` environment variable.

    All keys are expected to carry the ``rpnd_`` prefix.
    """

    def __init__(
        self,
        api_key: str | None = None,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float = DEFAULT_TIMEOUT,
    ) -> None:
        self.api_key = api_key or os.environ.get("DEBATEKIT_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

        if not self.api_key:
            raise ValueError(
                "DebateKit API key is required. Pass api_key or set DEBATEKIT_API_KEY."
            )

        if not self.api_key.startswith("rpnd_"):
            raise ValueError("DebateKit API keys must start with 'rpnd_'.")

    def _headers(self) -> dict[str, str]:
        return {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "x-debatekit-source": "crewai",
        }

    def post(self, path: str, body: dict[str, str | bool | list[str] | list[KnowledgeItem] | None]) -> DebateResult:
        """Send a POST request and return the parsed JSON response."""
        url = f"{self.base_url}{path}"
        # Strip None values so the API receives only supplied fields.
        payload = {k: v for k, v in body.items() if v is not None}

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload, headers=self._headers())
            response.raise_for_status()
            data: DebateResult = response.json()
            return data

    def get(self, path: str) -> ThreadLinkResult:
        """Send a GET request and return the parsed JSON response."""
        url = f"{self.base_url}{path}"

        with httpx.Client(timeout=self.timeout) as client:
            response = client.get(url, headers=self._headers())
            response.raise_for_status()
            data: ThreadLinkResult = response.json()
            return data


class KnowledgeItem(TypedDict):
    """A knowledge item to inject as context into a DebateKit debate."""
    content: str
    source: str
