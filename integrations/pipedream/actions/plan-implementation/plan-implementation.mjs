import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-plan-implementation",
  name: "Plan Implementation",
  description: "Create a step-by-step implementation plan with multi-model input. [See the documentation](https://debatekit.ai)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    feature: {
      type: "string",
      label: "Feature",
      description: "The feature or task to create an implementation plan for",
    },
    codebaseContext: {
      type: "string",
      label: "Codebase Context",
      description: "Relevant codebase context (architecture, patterns, conventions)",
      optional: true,
    },
    constraints: {
      type: "string[]",
      label: "Constraints",
      description: "Implementation constraints (e.g., backward compatibility, performance targets)",
      optional: true,
    },
    thinkingLevel: {
      propDefinition: [debatekit, "thinkingLevel"],
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.planImplementation({
      $,
      data: {
        feature: this.feature,
        codebase_context: this.codebaseContext,
        constraints: this.constraints,
        thinking_level: this.thinkingLevel,
      },
    });
    $.export("$summary", `Implementation plan created: "${truncate(this.feature)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
