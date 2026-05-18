import debatekit from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-list-sessions",
  name: "List Sessions",
  description: "Browse your recent DebateKit sessions with optional filtering. [See the documentation](https://debatekit.com)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    limit: {
      type: "integer",
      label: "Limit",
      description: "Max results to return (default 20)",
      default: 20,
      optional: true,
    },
    offset: {
      type: "integer",
      label: "Offset",
      description: "Pagination offset",
      default: 0,
      optional: true,
    },
    toolName: {
      type: "string",
      label: "Tool Name",
      description: "Filter by tool name (e.g., consult, architect, debug)",
      optional: true,
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const params = {};
    if (this.limit != null) params.limit = this.limit;
    if (this.offset != null) params.offset = this.offset;
    if (this.toolName) params.tool_name = this.toolName;
    const response = await this.debatekit.listSessions({
      $,
      params,
    });
    const count = response?.count ?? response?.sessions?.length ?? 0;
    $.export("$summary", `Retrieved ${count} session(s)`);
    return response;
  },
};
