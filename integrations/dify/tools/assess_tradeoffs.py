from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_ASSESS_TRADEOFFS, DebateKitBaseTool


class AssessTradeoffsTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_ASSESS_TRADEOFFS, {
            "decision": tool_parameters.get("decision", ""),
            "options": self._csv_to_list(tool_parameters.get("options")),
            "priorities": self._csv_to_list(tool_parameters.get("priorities")),
            "context": tool_parameters.get("context"),
            "thinking_level": tool_parameters.get("thinking_level"),
        })
        yield from self._format_result(result, "Tradeoff Assessment")
