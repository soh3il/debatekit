"""
DebateKit - Multi-AI Brainstorming (HuggingFace Spaces Gradio App)

Consult a council of AI models via the DebateKit REST API.
"""

import os
from typing import TypedDict

import gradio as gr
import httpx

# Source of truth: DEBATEKIT_DEFAULT_URL in integrations/shared/src/constants.ts
API_BASE = "https://mcp.debatekit.com/api/v1"
# Source of truth: DEBATEKIT_APP_URL in integrations/shared/src/constants.ts
APP_URL = "https://debatekit.com"
TIMEOUT = httpx.Timeout(120.0)

# Source of truth: ChatModeSchema in packages/shared/src/enums/chat.ts
CHAT_MODES = ["analyzing", "brainstorming", "debating", "solving"]
# Source of truth: McpThinkingLevelSchema in packages/shared/src/enums/mcp-tools.ts
THINKING_LEVELS = ["low", "medium", "high"]
# Focus areas for code review
FOCUS_OPTIONS = ["security", "performance", "best-practices", "architecture"]


# ── Response types ────────────────────────────────────────────────────────────
# Mirrors integrations/shared/src/types.ts (source of truth).

class TokenUsage(TypedDict):
    input: int
    output: int


class ParticipantResponse(TypedDict):
    model_id: str
    model_name: str
    response: str
    role: str | None
    token_usage: TokenUsage


class ModeratorResult(TypedDict):
    model_id: str
    summary: str
    token_usage: TokenUsage


class DebateMetadata(TypedDict, total=False):
    duration_ms: int
    format: str
    mode: str
    prompt_version: int | None
    thinking_level: str
    total_credits_used: float


class ConsultResponse(TypedDict, total=False):
    metadata: DebateMetadata
    moderator: ModeratorResult
    participants: list[ParticipantResponse]
    sessionId: str
    threadSlug: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def get_api_key() -> str:
    key = os.getenv("DEBATEKIT_API_KEY", "").strip()
    if not key:
        raise gr.Error(
            "DEBATEKIT_API_KEY environment variable is not set. "
            "Add it in your Space settings under Repository Secrets."
        )
    return key


def api_post(endpoint: str, payload: dict[str, object]) -> ConsultResponse:
    api_key = get_api_key()
    try:
        resp = httpx.post(
            f"{API_BASE}/{endpoint}",
            json=payload,
            headers={"x-api-key": api_key, "Content-Type": "application/json", "x-debatekit-source": "huggingface"},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data: ConsultResponse = resp.json()
        return data
    except httpx.HTTPStatusError as e:
        body = e.response.text
        raise gr.Error(f"API error {e.response.status_code}: {body}")
    except httpx.RequestError as e:
        raise gr.Error(f"Request failed: {e}")


def format_response(data: ConsultResponse) -> str:
    """Format the debate response as readable markdown."""
    parts: list[str] = []

    participants = data.get("participants", [])
    for p in participants:
        name = p.get("model_name", p.get("model_id", "Unknown"))
        role = p.get("role")
        header = f"## {name}"
        if role:
            header += f" ({role})"
        parts.append(header)
        parts.append(p.get("response", ""))
        parts.append("")

    moderator = data.get("moderator")
    if moderator:
        summary = moderator.get("summary", "")
        if summary:
            parts.append("---")
            parts.append("## Moderator Summary")
            parts.append(summary)
            parts.append("")

    metadata = data.get("metadata")
    if metadata:
        duration = metadata.get("duration_ms")
        mode = metadata.get("mode")
        level = metadata.get("thinking_level")
        credits = metadata.get("total_credits_used")
        meta_line = " | ".join(
            filter(None, [
                f"Mode: {mode}" if mode else None,
                f"Thinking: {level}" if level else None,
                f"Duration: {duration / 1000:.1f}s" if duration else None,
                f"Credits: {credits}" if credits is not None else None,
            ])
        )
        if meta_line:
            parts.append(f"*{meta_line}*")

    thread_slug = data.get("threadSlug")
    if thread_slug:
        # NOTE: Threads are private by default. This link only works if the
        # user has set the thread to public via set_thread_visibility.
        parts.append(
            f"\n[View full thread]({APP_URL}/public/chat/{thread_slug})"
        )

    return "\n\n".join(parts)


# ── Consult Council ──────────────────────────────────────────────────────────


def consult_council(prompt: str, thinking_level: str, mode: str) -> str:
    if not prompt.strip():
        raise gr.Error("Please enter a prompt.")

    payload: dict[str, object] = {
        "prompt": prompt.strip(),
        "thinking_level": thinking_level,
        "mode": mode,
    }
    data = api_post("consult", payload)
    return format_response(data)


# ── Code Review ──────────────────────────────────────────────────────────────


def review_code(
    code: str, language: str, focus: list[str], thinking_level: str
) -> str:
    if not code.strip():
        raise gr.Error("Please paste some code to review.")

    payload: dict[str, object] = {
        "code": code.strip(),
        "thinking_level": thinking_level,
    }
    if language:
        payload["language"] = language
    if focus:
        payload["focus"] = focus

    data = api_post("review-code", payload)
    return format_response(data)


# ── Assess Tradeoffs ────────────────────────────────────────────────────────


def assess_tradeoffs(
    decision: str,
    options: str,
    priorities: str,
    thinking_level: str,
) -> str:
    if not decision.strip():
        raise gr.Error("Please describe the decision.")

    options_list = [o.strip() for o in options.strip().splitlines() if o.strip()]
    priorities_list = [
        p.strip() for p in priorities.strip().splitlines() if p.strip()
    ]

    payload: dict[str, object] = {
        "decision": decision.strip(),
        "thinking_level": thinking_level,
    }
    if options_list:
        payload["options"] = options_list
    if priorities_list:
        payload["priorities"] = priorities_list

    data = api_post("assess-tradeoffs", payload)
    return format_response(data)


# ── Build UI ─────────────────────────────────────────────────────────────────

theme = gr.themes.Soft(primary_hue="indigo", secondary_hue="blue")

with gr.Blocks(theme=theme, title="DebateKit - Multi-AI Brainstorming") as demo:
    gr.Markdown(
        "# DebateKit\n"
        "Consult a council of AI models that debate, analyze, and solve problems together."
    )

    with gr.Tab("Consult Council"):
        with gr.Row():
            with gr.Column(scale=2):
                consult_prompt = gr.Textbox(
                    label="Prompt",
                    placeholder="Ask anything you want multiple AI models to discuss...",
                    lines=4,
                )
            with gr.Column(scale=1):
                consult_thinking = gr.Dropdown(
                    choices=THINKING_LEVELS,
                    value="medium",
                    label="Thinking Level",
                )
                consult_mode = gr.Dropdown(
                    choices=CHAT_MODES,
                    value="brainstorming",
                    label="Mode",
                )
                consult_btn = gr.Button("Submit", variant="primary")
        consult_output = gr.Markdown(label="Response")

        consult_btn.click(
            fn=consult_council,
            inputs=[consult_prompt, consult_thinking, consult_mode],
            outputs=consult_output,
        )

    with gr.Tab("Code Review"):
        with gr.Row():
            with gr.Column(scale=2):
                review_code_input = gr.Textbox(
                    label="Code",
                    placeholder="Paste your code here...",
                    lines=12,
                )
            with gr.Column(scale=1):
                review_language = gr.Dropdown(
                    choices=[
                        "python", "javascript", "typescript", "go", "rust",
                        "java", "c", "cpp", "ruby", "swift", "kotlin",
                    ],
                    value="python",
                    label="Language",
                )
                review_focus = gr.CheckboxGroup(
                    choices=FOCUS_OPTIONS,
                    value=["security", "performance", "best-practices"],
                    label="Focus Areas",
                )
                review_thinking = gr.Dropdown(
                    choices=THINKING_LEVELS,
                    value="medium",
                    label="Thinking Level",
                )
                review_btn = gr.Button("Submit", variant="primary")
        review_output = gr.Markdown(label="Response")

        review_btn.click(
            fn=review_code,
            inputs=[review_code_input, review_language, review_focus, review_thinking],
            outputs=review_output,
        )

    with gr.Tab("Assess Tradeoffs"):
        with gr.Row():
            with gr.Column(scale=2):
                tradeoff_decision = gr.Textbox(
                    label="Decision",
                    placeholder="What decision are you trying to make?",
                    lines=3,
                )
                tradeoff_options = gr.Textbox(
                    label="Options (one per line)",
                    placeholder="Option A\nOption B\nOption C",
                    lines=4,
                )
                tradeoff_priorities = gr.Textbox(
                    label="Priorities (one per line)",
                    placeholder="Cost\nSpeed\nReliability",
                    lines=4,
                )
            with gr.Column(scale=1):
                tradeoff_thinking = gr.Dropdown(
                    choices=THINKING_LEVELS,
                    value="medium",
                    label="Thinking Level",
                )
                tradeoff_btn = gr.Button("Submit", variant="primary")
        tradeoff_output = gr.Markdown(label="Response")

        tradeoff_btn.click(
            fn=assess_tradeoffs,
            inputs=[
                tradeoff_decision,
                tradeoff_options,
                tradeoff_priorities,
                tradeoff_thinking,
            ],
            outputs=tradeoff_output,
        )

if __name__ == "__main__":
    demo.launch()
