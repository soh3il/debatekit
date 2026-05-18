import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-debug-issue",
  name: "Debug Issue",
  description: "Debug an issue using multiple AI models analyzing the problem from different angles. [See the documentation](https://debatekit.com)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    problem: {
      type: "string",
      label: "Problem",
      description: "Description of the bug or issue to debug",
    },
    error: {
      type: "string",
      label: "Error Message",
      description: "The error message or stack trace",
      optional: true,
    },
    expectedBehavior: {
      type: "string",
      label: "Expected Behavior",
      description: "What should happen instead",
      optional: true,
    },
    code: {
      type: "string",
      label: "Code",
      description: "Relevant code snippet",
      optional: true,
    },
    thinkingLevel: {
      propDefinition: [debatekit, "thinkingLevel"],
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.debug({
      $,
      data: {
        problem: this.problem,
        error: this.error,
        expected_behavior: this.expectedBehavior,
        code: this.code,
        thinking_level: this.thinkingLevel,
      },
    });
    $.export("$summary", `Debugging completed: "${truncate(this.problem)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
