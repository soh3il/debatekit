"""Shared helper for DebateKit Dify tool implementations."""

from __future__ import annotations

from collections.abc import Generator
from typing import TypedDict

from dify_plugin import Tool
from dify_plugin.entities.tool import ToolInvokeMessage
import httpx

DEFAULT_BASE_URL = "https://mcp.debatekit.com"
DEFAULT_TIMEOUT = 120.0

# API endpoint path constants — source of truth for all Dify tools
ENDPOINT_CONSULT = "/consult"
ENDPOINT_REVIEW_CODE = "/review-code"
ENDPOINT_DEBUG = "/debug"
ENDPOINT_ARCHITECT = "/architect"
ENDPOINT_PLAN_IMPLEMENTATION = "/plan-implementation"
ENDPOINT_ASSESS_TRADEOFFS = "/assess-tradeoffs"


class DebateKitBaseTool(Tool):
    """Base class that handles auth, request, and response formatting for all DebateKit tools."""

    def _get_base_url(self) -> str:
        return (self.runtime.credentials.get("base_url", "") or DEFAULT_BASE_URL).rstrip("/")

    def _get_headers(self) -> dict[str, str]:
        api_key = self.runtime.credentials.get("api_key", "")
        return {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "x-debatekit-source": "dify",
        }

    def _post(self, path: str, body: dict[str, str | bool | list[str] | None]) -> DebateResult:
        """Send a POST request to the DebateKit REST API.

        None-valued keys are stripped before sending.
        """
        payload = {k: v for k, v in body.items() if v is not None}
        response = httpx.post(
            f"{self._get_base_url()}/api/v1{path}",
            headers=self._get_headers(),
            json=payload,
            timeout=DEFAULT_TIMEOUT,
        )
        response.raise_for_status()
        data: DebateResult = response.json()
        return data

    def _format_result(self, result: DebateResult, heading: str) -> Generator[ToolInvokeMessage]:
        """Format a standard debate result into a readable markdown message."""
        moderator = result.get("moderator", {})
        summary = moderator.get("summary", "No summary available") if moderator else "No summary available"
        participants = result.get("participants", [])

        parts: list[str] = [f"## {heading}\n\n{summary}\n"]
        for i, p in enumerate(participants):
            name = p.get("model_name", p.get("model_id", f"Participant {i + 1}"))
            role = p.get("role", "")
            resp = p.get("response", "")
            parts.append(f"### {name}{f' — {role}' if role else ''}\n\n{resp}\n")

        metadata = result.get("metadata")
        if metadata:
            credits = metadata.get("total_credits_used")
            if credits is not None:
                parts.append(f"---\n\n**Credits used:** {credits}")

        yield self.create_text_message("\n".join(parts))

    @staticmethod
    def _csv_to_list(value: str | None) -> list[str] | None:
        """Split a comma-separated string into a list, or return None."""
        if not value:
            return None
        return [item.strip() for item in value.split(",") if item.strip()]


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
