/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** API Key - Your DebateKit API key (starts with rpnd_). Get one at debatekit.ai/chat/settings/api-keys. */
  "apiKey": string,
  /** API Base URL - Override the default API endpoint. */
  "baseUrl": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `consult` command */
  export type Consult = ExtensionPreferences & {}
  /** Preferences accessible in the `review-code` command */
  export type ReviewCode = ExtensionPreferences & {}
  /** Preferences accessible in the `debug` command */
  export type Debug = ExtensionPreferences & {}
  /** Preferences accessible in the `plan-implementation` command */
  export type PlanImplementation = ExtensionPreferences & {}
  /** Preferences accessible in the `assess-tradeoffs` command */
  export type AssessTradeoffs = ExtensionPreferences & {}
  /** Preferences accessible in the `sessions` command */
  export type Sessions = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `consult` command */
  export type Consult = {}
  /** Arguments passed to the `review-code` command */
  export type ReviewCode = {}
  /** Arguments passed to the `debug` command */
  export type Debug = {}
  /** Arguments passed to the `plan-implementation` command */
  export type PlanImplementation = {}
  /** Arguments passed to the `assess-tradeoffs` command */
  export type AssessTradeoffs = {}
  /** Arguments passed to the `sessions` command */
  export type Sessions = {}
}

