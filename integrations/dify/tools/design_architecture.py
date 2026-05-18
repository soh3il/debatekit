from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_ARCHITECT, DebateKitBaseTool


class DesignArchitectureTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_ARCHITECT, {
            "description": tool_parameters.get("description", ""),
            "scale": tool_parameters.get("scale"),
            "tech_stack": self._csv_to_list(tool_parameters.get("tech_stack")),
            "focus_areas": self._csv_to_list(tool_parameters.get("focus_areas")),
        })
        yield from self._format_result(result, "Architecture Design")
