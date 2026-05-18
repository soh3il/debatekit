import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-assess-tradeoffs",
  name: "Assess Tradeoffs",
  description: "Evaluate options and trade-offs with structured multi-model analysis. [See the documentation](https://debatekit.com)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    decision: {
      type: "string",
      label: "Decision",
      description: "The decision or question to evaluate trade-offs for",
    },
    options: {
      type: "string[]",
      label: "Options",
      description: "The options to compare (e.g., REST vs GraphQL, Postgres vs DynamoDB)",
    },
    priorities: {
      type: "string[]",
      label: "Priorities",
      description: "What matters most (e.g., performance, developer experience, cost)",
      optional: true,
    },
    context: {
      type: "string",
      label: "Context",
      description: "Background context — codebase, team, timeline, constraints",
      optional: true,
    },
    thinkingLevel: {
      propDefinition: [debatekit, "thinkingLevel"],
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.assessTradeoffs({
      $,
      data: {
        decision: this.decision,
        options: this.options,
        priorities: this.priorities,
        context: this.context,
        thinking_level: this.thinkingLevel,
      },
    });
    $.export("$summary", `Tradeoff assessment completed: "${truncate(this.decision)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
