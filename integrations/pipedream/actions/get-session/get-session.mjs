import debatekit from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-get-session",
  name: "Get Session",
  description: "Get details of a specific DebateKit session. [See the documentation](https://debatekit.ai)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    sessionId: {
      propDefinition: [debatekit, "sessionId"],
      description: "The ID of the session to retrieve",
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.getSession({
      $,
      sessionId: this.sessionId,
    });
    $.export("$summary", `Retrieved session ${this.sessionId}`);
    return response;
  },
};
