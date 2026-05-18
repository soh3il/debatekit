import debatekit, { truncate } from "../../debatekit.app/debatekit.app.mjs";

export default {
  key: "debatekit-design-architecture",
  name: "Design Architecture",
  description: "Get architectural recommendations from multiple AI models for system design decisions. [See the documentation](https://debatekit.ai)",
  version: "1.0.0",
  type: "action",
  props: {
    debatekit,
    description: {
      type: "string",
      label: "Description",
      description: "System description or architectural question",
    },
    scale: {
      type: "string",
      label: "Scale",
      description: "Target scale: startup (small team), growth (scaling), enterprise (large org)",
      options: ["startup", "growth", "enterprise"],
      default: "startup",
      optional: true,
    },
    techStack: {
      type: "string[]",
      label: "Tech Stack",
      description: "Preferred technologies",
      optional: true,
    },
  },
  /** @param {object} params @param {object} params.$ */
  async run({ $ }) {
    const response = await this.debatekit.architect({
      $,
      data: {
        description: this.description,
        scale: this.scale,
        tech_stack: this.techStack,
      },
    });
    $.export("$summary", `Architecture design completed: "${truncate(this.description)}"`);
    $.export("credits_used", response.metadata?.total_credits_used ?? 0);
    return response;
  },
};
