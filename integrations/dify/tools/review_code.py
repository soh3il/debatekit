from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_REVIEW_CODE, DebateKitBaseTool


class ReviewCodeTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_REVIEW_CODE, {
            "code": tool_parameters.get("code", ""),
            "language": tool_parameters.get("language"),
            "focus": self._csv_to_list(tool_parameters.get("focus")),
            "thinking_level": tool_parameters.get("thinking_level"),
        })
        yield from self._format_result(result, "Code Review Summary")
