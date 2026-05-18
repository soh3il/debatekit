/**
 * Root ESLint configuration for monorepo
 * Used by lint-staged when running from the root directory
 */
import type { Linter } from 'eslint';

import { createConfig } from './packages/eslint-config/src/base';

async function createRootConfig(): Promise<Linter.Config[]> {
  const configs = await createConfig({
    drizzle: true,
    ignores: ['**/public/**', 'integrations/**', '.agents/**'],
    react: true,
  });

  // API package: Disable require-atomic-updates for all TS files
  // (Same as apps/api/eslint.config.ts via createApiConfig)
  configs.push({
    files: ['apps/api/**/*.ts'],
    rules: {
      'require-atomic-updates': 'off',
    },
  });

  // Web package: Disable require-atomic-updates for React files and hooks
  // (Same as apps/web/eslint.config.ts via createWebConfig)
  configs.push({
    files: ['apps/web/**/*.tsx', 'apps/web/**/*.jsx'],
    rules: {
      'require-atomic-updates': 'off',
    },
  });

  configs.push({
    files: ['apps/web/**/hooks/**/*.ts', 'apps/web/**/providers/**/*.ts'],
    rules: {
      'require-atomic-updates': 'off',
    },
  });

  // Build/maintenance scripts: allow console output and dynamic fs paths.
  // These scripts are CLI tools (run via `bun run i18n:*`, `tsx scripts/*.ts`)
  // where console logging is the intended UX and file paths are intentionally
  // constructed from CLI args / glob results.
  configs.push({
    files: ['scripts/**/*.ts'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  });

  return configs;
}

export default createRootConfig();
