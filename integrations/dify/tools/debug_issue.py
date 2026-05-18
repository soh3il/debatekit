from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_DEBUG, DebateKitBaseTool


class DebugIssueTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_DEBUG, {
            "problem": tool_parameters.get("problem", ""),
            "error": tool_parameters.get("error"),
            "code": tool_parameters.get("code"),
            "expected_behavior": tool_parameters.get("expected_behavior"),
            "thinking_level": tool_parameters.get("thinking_level"),
        })
        yield from self._format_result(result, "Debug Analysis")
