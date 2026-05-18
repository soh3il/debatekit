from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_PLAN_IMPLEMENTATION, DebateKitBaseTool


class PlanImplementationTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_PLAN_IMPLEMENTATION, {
            "feature": tool_parameters.get("feature", ""),
            "codebase_context": tool_parameters.get("codebase_context"),
            "constraints": self._csv_to_list(tool_parameters.get("constraints")),
            "tech_stack": self._csv_to_list(tool_parameters.get("tech_stack")),
            "thinking_level": tool_parameters.get("thinking_level"),
        })
        yield from self._format_result(result, "Implementation Plan")
