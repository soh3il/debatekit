"""CrewAI tools for the DebateKit multi-model AI brainstorming platform."""

from __future__ import annotations

import json

from crewai.tools import BaseTool
from pydantic import BaseModel, Field

from .api import (
    ENDPOINT_ARCHITECT,
    ENDPOINT_ASSESS_TRADEOFFS,
    ENDPOINT_CONSULT,
    ENDPOINT_DEBUG,
    ENDPOINT_PLAN_IMPLEMENTATION,
    ENDPOINT_REVIEW_CODE,
    DebateResult,
    KnowledgeItem,
    DebateKitClient,
    ThreadLinkResult,
)

API_KEY_SETTINGS_PATH = "/chat/settings/api-keys"


# ---------------------------------------------------------------------------
# Input schemas — aligned with MCP tool-schemas.ts
# ---------------------------------------------------------------------------

class ConsultInput(BaseModel):
    """Input for the DebateKit consult endpoint."""

    prompt: str = Field(..., description="The question, topic, or problem to debate.")
    context: str | None = Field(None, description="Additional background context for the debate (code, docs, requirements).")
    mode: str | None = Field(
        None,
        description="Conversation mode: 'analyzing' (research), 'brainstorming' (ideas), 'debating' (tradeoffs), 'solving' (action plans).",
    )
    format: str | None = Field(
        None,
        description="Moderator output format: 'discussion' (narrative), 'adr' (architecture decision), 'comparison' (table), 'pros-cons'.",
    )
    thinking_level: str | None = Field(
        None,
        description="Controls model quality and cost: 'low' (fast/cheap), 'medium' (balanced), 'high' (maximum reasoning).",
    )
    models: str | None = Field(
        None,
        description="Comma-separated list of model identifiers to include in the round (min 3). Use list-models to see options.",
    )
    roles: str | None = Field(
        None,
        description="Comma-separated list of roles for participants (e.g. 'Security Architect,Backend Engineer').",
    )
    auto_route: bool | None = Field(
        None,
        description="Auto-select optimal models based on prompt analysis and historical performance.",
    )
    session_context: str | None = Field(
        None,
        description="Comma-separated session IDs to use as context (max 3). Prior moderator summaries will be prepended.",
    )
    knowledge: str | None = Field(
        None,
        description="JSON array of knowledge items to inject as context (max 5). Each item: {\"content\": \"...\", \"source\": \"...\"}.",
    )
    webhook_url: str | None = Field(
        None,
        description="Webhook URL to POST results to after completion.",
    )


class CodeReviewInput(BaseModel):
    """Input for the DebateKit code review endpoint."""

    code: str = Field(..., description="The code to review.")
    language: str | None = Field(
        None,
        description="Programming language (auto-detected if not specified).",
    )
    focus: str | None = Field(
        None,
        description="Comma-separated review focus areas (e.g. 'security,performance').",
    )
    thinking_level: str | None = Field(
        None,
        description="Review depth: 'low' (quick scan), 'medium' (balanced), 'high' (thorough).",
    )


class DebugInput(BaseModel):
    """Input for the DebateKit debug endpoint."""

    problem: str = Field(..., description="Describe the bug, failure, or unexpected behavior.")
    error: str | None = Field(None, description="Error message, stack trace, or unexpected output.")
    code: str | None = Field(None, description="The relevant code where the bug occurs.")
    expected_behavior: str | None = Field(
        None, description="What should happen vs what actually happens."
    )
    thinking_level: str | None = Field(
        None,
        description="Analysis depth: 'low', 'medium', 'high'.",
    )


class ArchitectInput(BaseModel):
    """Input for the DebateKit architecture design endpoint."""

    description: str = Field(
        ..., description="What the system should do."
    )
    scale: str | None = Field(
        None,
        description="Target scale: 'startup' (small team), 'growth' (scaling), 'enterprise' (large org). Defaults to 'startup'.",
    )
    tech_stack: str | None = Field(
        None,
        description="Comma-separated list of preferred technologies.",
    )
    focus_areas: str | None = Field(
        None,
        description="Comma-separated priority areas (e.g. 'security,performance').",
    )


class PlanImplementationInput(BaseModel):
    """Input for the DebateKit plan-implementation endpoint."""

    feature: str = Field(..., description="The feature or change to plan.")
    codebase_context: str | None = Field(
        None,
        description="Relevant existing code, file structure, or architecture notes.",
    )
    constraints: str | None = Field(
        None,
        description="Comma-separated constraints (e.g. 'no breaking changes,must support offline').",
    )
    tech_stack: str | None = Field(
        None,
        description="Comma-separated current tech stack.",
    )
    thinking_level: str | None = Field(
        None,
        description="Planning depth: 'low', 'medium', 'high'.",
    )


class AssessTradeoffsInput(BaseModel):
    """Input for the DebateKit assess-tradeoffs endpoint."""

    decision: str = Field(..., description="The decision or question to evaluate.")
    options: str | None = Field(
        None,
        description="Comma-separated options to compare (e.g. 'REST,GraphQL,gRPC').",
    )
    priorities: str | None = Field(
        None,
        description="Comma-separated priorities — what matters most (e.g. 'performance,dx,cost').",
    )
    context: str | None = Field(
        None,
        description="Background context — codebase, team, timeline, constraints.",
    )
    thinking_level: str | None = Field(
        None,
        description="Analysis depth: 'low', 'medium', 'high'.",
    )


class GetThreadLinkInput(BaseModel):
    """Input for the DebateKit get-thread-link endpoint."""

    session_id: str = Field(..., description="The session ID to get the thread link for.")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client() -> DebateKitClient:
    """Build a client using the environment variable."""
    return DebateKitClient()


def _csv_to_list(value: str | None) -> list[str] | None:
    """Split a comma-separated string into a list, or return None."""
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def _format_debate_response(data: DebateResult) -> str:
    """Return a human-readable JSON string of a debate API response with credits info."""
    metadata = data.get("metadata")
    credits_line = ""
    if metadata:
        credits = metadata.get("total_credits_used")
        if credits is not None:
            credits_line = f"\n\n---\nCredits used: {credits}"
    return json.dumps(data, indent=2, ensure_ascii=False) + credits_line


def _format_thread_link_response(data: ThreadLinkResult) -> str:
    """Return a human-readable JSON string of a thread link API response."""
    return json.dumps(data, indent=2, ensure_ascii=False)


def _parse_knowledge(value: str | None) -> list[KnowledgeItem] | None:
    """Parse a JSON string of knowledge items, or return None.

    Each item must have 'content' and 'source' string fields.
    Invalid items are silently dropped.
    """
    if not value:
        return None
    try:
        raw = json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(raw, list):
        return None
    validated: list[KnowledgeItem] = []
    for item in raw:
        if (
            isinstance(item, dict)
            and isinstance(item.get("content"), str)
            and isinstance(item.get("source"), str)
        ):
            validated.append(KnowledgeItem(content=item["content"], source=item["source"]))
    return validated if validated else None


# ---------------------------------------------------------------------------
# Tools
# ---------------------------------------------------------------------------

class DebateKitConsultTool(BaseTool):
    name: str = "debatekit_consult"
    description: str = (
        "Consult DebateKit's AI council — multiple models discuss your engineering "
        "question sequentially (each sees prior responses), then a moderator synthesizes. "
        "Auto-mode by default — AI picks optimal models, roles, and conversation mode "
        "from your prompt. Provide explicit models to override (manual mode). "
        "Fully configurable: mode, format, roles, models, thinking level."
    )
    args_schema: type[BaseModel] = ConsultInput

    def _run(
        self,
        prompt: str,
        context: str | None = None,
        mode: str | None = None,
        format: str | None = None,
        thinking_level: str | None = None,
        models: str | None = None,
        roles: str | None = None,
        auto_route: bool | None = None,
        session_context: str | None = None,
        knowledge: str | None = None,
        webhook_url: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "prompt": prompt,
            "context": context,
            "mode": mode,
            "format": format,
            "thinking_level": thinking_level,
            "models": _csv_to_list(models),
            "roles": _csv_to_list(roles),
            "auto_route": auto_route,
            "session_context": _csv_to_list(session_context),
            "knowledge": _parse_knowledge(knowledge),
            "webhook_url": webhook_url,
        }
        result = client.post(ENDPOINT_CONSULT, body)
        return _format_debate_response(result)


class DebateKitCodeReviewTool(BaseTool):
    name: str = "debatekit_code_review"
    description: str = (
        "Submit code to DebateKit for a multi-model code review. "
        "Returns feedback on bugs, style, security, and improvement suggestions."
    )
    args_schema: type[BaseModel] = CodeReviewInput

    def _run(
        self,
        code: str,
        language: str | None = None,
        focus: str | None = None,
        thinking_level: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "code": code,
            "language": language,
            "focus": _csv_to_list(focus),
            "thinking_level": thinking_level,
        }
        result = client.post(ENDPOINT_REVIEW_CODE, body)
        return _format_debate_response(result)


class DebateKitDebugTool(BaseTool):
    name: str = "debatekit_debug"
    description: str = (
        "Send a bug report to DebateKit's AI council for collaborative "
        "debugging. Provide the problem description, error output, and "
        "relevant code to get root-cause analysis and fix suggestions."
    )
    args_schema: type[BaseModel] = DebugInput

    def _run(
        self,
        problem: str,
        error: str | None = None,
        code: str | None = None,
        expected_behavior: str | None = None,
        thinking_level: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "problem": problem,
            "error": error,
            "code": code,
            "expected_behavior": expected_behavior,
            "thinking_level": thinking_level,
        }
        result = client.post(ENDPOINT_DEBUG, body)
        return _format_debate_response(result)


class DebateKitArchitectTool(BaseTool):
    name: str = "debatekit_architect"
    description: str = (
        "Ask DebateKit's AI council to design a system architecture. "
        "Describe what you're building, the expected scale, and optional "
        "tech-stack preferences to receive a collaborative architecture proposal."
    )
    args_schema: type[BaseModel] = ArchitectInput

    def _run(
        self,
        description: str,
        scale: str | None = None,
        tech_stack: str | None = None,
        focus_areas: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "description": description,
            "scale": scale,
            "tech_stack": _csv_to_list(tech_stack),
            "focus_areas": _csv_to_list(focus_areas),
        }
        result = client.post(ENDPOINT_ARCHITECT, body)
        return _format_debate_response(result)


class DebateKitPlanImplementationTool(BaseTool):
    name: str = "debatekit_plan_implementation"
    description: str = (
        "Create a step-by-step implementation plan with multi-model input. "
        "Describe the feature, provide codebase context, and list constraints "
        "to receive a collaborative implementation roadmap."
    )
    args_schema: type[BaseModel] = PlanImplementationInput

    def _run(
        self,
        feature: str,
        codebase_context: str | None = None,
        constraints: str | None = None,
        tech_stack: str | None = None,
        thinking_level: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "feature": feature,
            "codebase_context": codebase_context,
            "constraints": _csv_to_list(constraints),
            "tech_stack": _csv_to_list(tech_stack),
            "thinking_level": thinking_level,
        }
        result = client.post(ENDPOINT_PLAN_IMPLEMENTATION, body)
        return _format_debate_response(result)


class DebateKitAssessTradeoffsTool(BaseTool):
    name: str = "debatekit_assess_tradeoffs"
    description: str = (
        "Evaluate options and trade-offs with structured multi-model analysis. "
        "Provide a decision, the options to compare, and any priorities to "
        "receive a balanced assessment from multiple AI perspectives."
    )
    args_schema: type[BaseModel] = AssessTradeoffsInput

    def _run(
        self,
        decision: str,
        options: str | None = None,
        priorities: str | None = None,
        context: str | None = None,
        thinking_level: str | None = None,
    ) -> str:
        client = _get_client()
        body = {
            "decision": decision,
            "options": _csv_to_list(options),
            "priorities": _csv_to_list(priorities),
            "context": context,
            "thinking_level": thinking_level,
        }
        result = client.post(ENDPOINT_ASSESS_TRADEOFFS, body)
        return _format_debate_response(result)


class DebateKitGetThreadLinkTool(BaseTool):
    name: str = "debatekit_get_thread_link"
    description: str = (
        "Get the dashboard URL for a previous debate session. "
        "Returns the thread link and public URL if the thread is public."
    )
    args_schema: type[BaseModel] = GetThreadLinkInput

    def _run(self, session_id: str) -> str:
        client = _get_client()
        result = client.get(f"/sessions/{session_id}/thread-link")
        return _format_thread_link_response(result)
