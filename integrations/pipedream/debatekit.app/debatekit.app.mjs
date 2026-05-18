import { axios } from "@pipedream/platform";

/** @type {number} Max characters for summary text truncation */
const SUMMARY_MAX_LENGTH = 60;

/** @type {string} Base URL for the DebateKit REST API */
const BASE_URL = "https://mcp.debatekit.ai/api/v1";

/**
 * Truncates text for use in Pipedream $summary exports.
 * Appends ellipsis only when text exceeds the max length.
 * @param {string} text
 * @param {number} [maxLength]
 * @returns {string}
 */
function truncate(text, maxLength = SUMMARY_MAX_LENGTH) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

export { truncate };

export default {
  type: "app",
  app: "debatekit",
  propDefinitions: {
    prompt: {
      type: "string",
      label: "Prompt",
      description: "The question or topic for the AI council to discuss",
    },
    thinkingLevel: {
      type: "string",
      label: "Thinking Level",
      description: "Depth of analysis: low (fast/cheap), medium (balanced), high (maximum reasoning)",
      options: ["low", "medium", "high"],
      default: "medium",
      optional: true,
    },
    mode: {
      type: "string",
      label: "Mode",
      description: "Conversation mode: analyzing (research), brainstorming (ideas), debating (tradeoffs), solving (action plans)",
      options: ["analyzing", "brainstorming", "debating", "solving"],
      default: "debating",
      optional: true,
    },
    sessionId: {
      type: "string",
      label: "Session ID",
      description: "The ID of a DebateKit session",
    },
  },
  methods: {
    /**
     * @returns {string}
     */
    getBaseUrl() {
      return BASE_URL;
    },
    /**
     * @returns {{ "Content-Type": string, "x-api-key": string }}
     */
    getHeaders() {
      return {
        "Content-Type": "application/json",
        "x-api-key": this.$auth.api_key,
        "x-debatekit-source": "pipedream",
      };
    },
    /**
     * @param {object} opts
     * @param {object} [opts.$]
     * @param {string} opts.path
     * @returns {Promise<object>}
     */
    async makeRequest({ $ = this, path, ...opts }) {
      return axios($, {
        url: `${this.getBaseUrl()}${path}`,
        headers: this.getHeaders(),
        ...opts,
      });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async consult({ $, ...opts }) {
      return this.makeRequest({ $, path: "/consult", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async architect({ $, ...opts }) {
      return this.makeRequest({ $, path: "/architect", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async reviewCode({ $, ...opts }) {
      return this.makeRequest({ $, path: "/review-code", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async debug({ $, ...opts }) {
      return this.makeRequest({ $, path: "/debug", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async planImplementation({ $, ...opts }) {
      return this.makeRequest({ $, path: "/plan-implementation", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async assessTradeoffs({ $, ...opts }) {
      return this.makeRequest({ $, path: "/assess-tradeoffs", method: "POST", ...opts });
    },
    /** @param {object} opts @returns {Promise<object>} */
    async listSessions({ $, ...opts }) {
      return this.makeRequest({ $, path: "/sessions", method: "GET", ...opts });
    },
    /**
     * @param {object} opts
     * @param {string} opts.sessionId
     * @returns {Promise<object>}
     */
    async getSession({ $, sessionId, ...opts }) {
      return this.makeRequest({ $, path: `/sessions/${sessionId}`, method: "GET", ...opts });
    },
    /**
     * @param {object} opts
     * @param {string} opts.sessionId
     * @returns {Promise<object>}
     */
    async getThreadLink({ $, sessionId, ...opts }) {
      return this.makeRequest({ $, path: `/threads/${sessionId}/link`, method: "GET", ...opts });
    },
  },
};
