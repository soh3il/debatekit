import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-consult-council",
  name: "Consult Council",
  description: "Run a multi-model AI debate on any question. Multiple AI models discuss your prompt, then a moderator synthesizes all perspectives. [See the documentation](https://debatekit.ai)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    prompt: {
      propDefinition: [debatekit, "prompt"],
    },
    thinkingLevel: {
      propDefinition: [debatekit, "thinkingLevel"],
    },
    mode: {
      propDefinition: [debatekit, "mode"],
    },
    context: {
      type: "string",
      label: "Context",
      description: "Additional context for the discussion",
      optional: true,
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.consult({
      $,
      data: {
        prompt: this.prompt,
        thinking_level: this.thinkingLevel,
        mode: this.mode,
        context: this.context,
      },
    });
    $.export("$summary", `Council discussion completed: "${truncate(this.prompt)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
