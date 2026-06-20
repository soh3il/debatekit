/* eslint-disable no-console, security/detect-non-literal-fs-filename -- trusted build script; paths are derived from import.meta.dirname + string literals */
/**
 * Patch TanStack Start's generated wrangler.json with env-specific config.
 *
 * TanStack Start generates a flat `dist/server/wrangler.json` that ignores
 * wrangler env blocks. This script reads the env config from `wrangler.jsonc`
 * and patches the generated config with the correct name, routes, vars, etc.
 *
 * Usage: bun run scripts/patch-wrangler-env.ts <preview|production>
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TRAILING_COMMA_RE = /,(\s*[}\]])/g;

const env = process.argv[2];
if (!env || !['preview', 'production'].includes(env)) {
  console.error('Usage: bun run scripts/patch-wrangler-env.ts <preview|production>');
  process.exit(1);
}

const genPath = resolve(import.meta.dirname, '..', 'dist', 'server', 'wrangler.json');
const srcPath = resolve(import.meta.dirname, '..', 'wrangler.jsonc');

// Parse the generated config
const gen = JSON.parse(readFileSync(genPath, 'utf8'));

// Parse JSONC: strip line comments (but not inside strings) and trailing commas
// Use a state machine to avoid stripping // inside string values
function stripJsoncComments(text: string) {
  let result = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (escape) {
      result += ch;
      escape = false;
      continue;
    }

    if (inString) {
      if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = true;
      result += ch;
      continue;
    }

    // Line comment
    if (ch === '/' && next === '/') {
      const eol = text.indexOf('\n', i);
      i = eol === -1 ? text.length : eol - 1;
      continue;
    }

    // Block comment
    if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end === -1 ? text.length : end + 1;
      continue;
    }

    result += ch;
  }

  return result;
}

const src = JSON.parse(stripJsoncComments(readFileSync(srcPath, 'utf8')).replace(TRAILING_COMMA_RE, '$1'));

const envConfig = src.env?.[env];
if (!envConfig) {
  console.error(`No env block found for "${env}" in wrangler.jsonc`);
  process.exit(1);
}

// Apply env overrides to generated config
if (envConfig.name) {
  gen.name = envConfig.name;
}
if (envConfig.routes) {
  gen.routes = envConfig.routes;
}
if (envConfig.vars) {
  gen.vars = envConfig.vars;
}
if (envConfig.upload_source_maps !== undefined) {
  gen.upload_source_maps = envConfig.upload_source_maps;
}
if (envConfig.observability) {
  gen.observability = envConfig.observability;
}
if (envConfig.workers_dev !== undefined) {
  gen.workers_dev = envConfig.workers_dev;
}
if (envConfig.placement) {
  gen.placement = envConfig.placement;
}

// Remove fields that cause errors in redirected configs
delete gen.definedEnvironments;

writeFileSync(genPath, JSON.stringify(gen));

console.warn(`Patched dist/server/wrangler.json for ${env}: name=${gen.name}`);
