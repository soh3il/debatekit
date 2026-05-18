import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-review-code",
  name: "Review Code",
  description: "Get a multi-perspective code review from multiple AI models. [See the documentation](https://debatekit.ai)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    code: {
      type: "string",
      label: "Code",
      description: "The code to review",
    },
    language: {
      type: "string",
      label: "Language",
      description: "Programming language",
      optional: true,
    },
    focus: {
      type: "string[]",
      label: "Focus Areas",
      description: "Specific areas to focus on (e.g., security, performance)",
      optional: true,
    },
    thinkingLevel: {
      propDefinition: [debatekit, "thinkingLevel"],
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.reviewCode({
      $,
      data: {
        code: this.code,
        language: this.language,
        focus: this.focus,
        thinking_level: this.thinkingLevel,
      },
    });
    const label = this.language ?? "code";
    $.export("$summary", `Code review completed: "${truncate(label)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
