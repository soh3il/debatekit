import debatekit from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-get-thread-link",
  name: "Get Thread Link",
  description: "Get a shareable link to a DebateKit session thread. [See the documentation](https://debatekit.com)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    sessionId: {
      propDefinition: [debatekit, "sessionId"],
      description: "The ID of the session to get a thread link for",
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.getThreadLink({
      $,
      sessionId: this.sessionId,
    });
    $.export("$summary", `Thread link retrieved for session ${this.sessionId}`);
    return response;
  },
};
