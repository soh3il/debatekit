/**
 * ESLint configuration for DB package (Drizzle ORM tables, schemas, services)
 */
import type { Linter } from 'eslint';

import { createConfig } from '@debatekit/eslint-config/base';

export async function createDbConfig(): Promise<Linter.Config[]> {
  const configs = await createConfig({
    drizzle: true,
    ignores: [],
    react: false,
  });

  // Service layer and schema factories - complex return types inferred by TS
  configs.push({
    files: ['**/services/**/*.ts', '**/schemas/**/*.ts'],
    rules: {
      'ts/explicit-function-return-type': 'off',
    },
  });

  return configs;
}

export default createDbConfig();
