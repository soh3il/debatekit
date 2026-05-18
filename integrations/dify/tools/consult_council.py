from __future__ import annotations

from collections.abc import Generator

from dify_plugin.entities.tool import ToolInvokeMessage

from ._base import ENDPOINT_CONSULT, DebateKitBaseTool


class ConsultCouncilTool(DebateKitBaseTool):
    def _invoke(
        self, tool_parameters: dict[str, str | bool | None]
    ) -> Generator[ToolInvokeMessage]:
        result = self._post(ENDPOINT_CONSULT, {
            "prompt": tool_parameters.get("prompt", ""),
            "context": tool_parameters.get("context"),
            "mode": tool_parameters.get("mode"),
            "format": tool_parameters.get("format"),
            "thinking_level": tool_parameters.get("thinking_level"),
            "models": self._csv_to_list(str(tool_parameters.get("models", "")) or None),
            "roles": self._csv_to_list(str(tool_parameters.get("roles", "")) or None),
            "auto_route": tool_parameters.get("auto_route"),
        })
        yield from self._format_result(result, "Moderator Summary")
