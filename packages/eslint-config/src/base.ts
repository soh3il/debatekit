/**
 * Base ESLint configuration factory using @antfu/eslint-config
 * Maximum strict rules for code quality. Type checking via `check-types`.
 */
import antfu from '@antfu/eslint-config';
import type { Linter } from 'eslint';
import drizzlePlugin from 'eslint-plugin-drizzle';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import simpleImportSort from 'eslint-plugin-simple-import-sort';

type ConfigOptions = {
  drizzle?: boolean;
  ignores?: string[];
  react?: boolean;
};

const baseIgnores = [
  '**/dist/**',
  '**/dist-test/**',
  '**/.output/**',
  '**/.turbo/**',
  '**/node_modules/**',
  '**/coverage/**',
  '**/*.json',
  '**/*.jsonc',
  '**/*.md',
  '**/*.css',
  '**/*.scss',
  '**/*.yml',
  '**/*.yaml',
  '**/*.toml',
  '**/eslint.config.ts',
  '**/drizzle.config.ts',
  '**/vitest.config.ts',
  '**/vitest.setup.ts',
  '**/*.config.js',
  '**/*.config.mjs',
  '**/*.config.cjs',
];

export async function createConfig(options: ConfigOptions = {}): Promise<Linter.Config[]> {
  const {
    drizzle = false,
    ignores = [],
    react = false,
  } = options;

  // Follow antfu pattern: pass config objects directly to antfu()
  const configs = await antfu(
    // Main config options
    {
      formatters: {
        css: true,
      },
      ignores: [...baseIgnores, ...ignores],
      // Let antfu auto-detect editor mode for consistent IDE + CLI behavior
      // When explicitly false, VS Code shows fewer errors than CLI
      lessOpinionated: false,
      react: react
        ? {
            a11y: true,
            // eslint-plugin-react-x@2.13+ no-implicit-key requires type info
            // but antfu's React config block doesn't have projectService.
            // Disable until antfu supports type-aware React rules natively.
            overrides: {
              'react/no-implicit-key': 'off',
              // @eslint-react v5 introduced many new/stricter react-x rules absent in v2.
              // They flag long-standing intentional patterns, not regressions. Surface as
              // warnings (non-blocking) pending a dedicated triage pass.
              'react/dom-no-flush-sync': 'warn',
              'react/no-children-prop': 'warn',
              'react/static-components': 'warn',
              'react/unsupported-syntax': 'warn',
            },
          }
        : false,
      stylistic: {
        semi: true,
      },
      typescript: {
        // Enable ALL type-aware rules for maximum strictness
        overridesTypeAware: {
          'ts/await-thenable': 'error',
          'ts/no-floating-promises': 'error',
          'ts/no-for-in-array': 'error',
          'ts/no-misused-promises': ['error', { checksVoidReturn: false }],
          'ts/no-unnecessary-type-assertion': 'error',
          'ts/no-unsafe-argument': 'error',
          'ts/no-unsafe-assignment': 'error',
          'ts/no-unsafe-call': 'error',
          'ts/no-unsafe-member-access': 'error',
          'ts/no-unsafe-return': 'error',
          'ts/prefer-nullish-coalescing': ['error', { ignorePrimitives: true }],
          'ts/prefer-optional-chain': 'error',
          'ts/require-await': 'error',
          'ts/restrict-plus-operands': 'error',
          'ts/restrict-template-expressions': ['error', { allowBoolean: true, allowNumber: true }],
          'ts/return-await': ['error', 'in-try-catch'],
          'ts/strict-boolean-expressions': ['error', {
            allowNullableBoolean: true,
            allowNullableObject: true,
            allowNullableString: true,
            allowNumber: false,
            allowString: false,
          }],
          'ts/switch-exhaustiveness-check': 'error',
          'ts/unbound-method': ['error', { ignoreStatic: true }],
        },
      },
    },

    // Import Sorting - use simple-import-sort, disable conflicting rules
    {
      plugins: {
        'simple-import-sort': simpleImportSort,
      },
      rules: {
        'import/order': 'off',
        'perfectionist/sort-exports': 'off',
        'perfectionist/sort-imports': 'off',
        'perfectionist/sort-named-exports': 'off',
        'perfectionist/sort-named-imports': 'off',
        'simple-import-sort/exports': 'error',
        'simple-import-sort/imports': 'error',
        'sort-imports': 'off',
      },
    },

    // Drizzle ORM rules (conditional)
    ...(drizzle
      ? [
          {
            plugins: {
              drizzle: drizzlePlugin,
            },
            rules: {
              'drizzle/enforce-delete-with-where': [
                'error',
                { drizzleObjectName: ['db', 'batch'] },
              ],
              'drizzle/enforce-update-with-where': [
                'error',
                { drizzleObjectName: ['db', 'batch'] },
              ],
            },
          },
        ]
      : []),

    // Security plugin - strict security rules
    {
      plugins: {
        security: securityPlugin,
      },
      rules: {
        'security/detect-buffer-noassert': 'error',
        'security/detect-child-process': 'error',
        'security/detect-eval-with-expression': 'error',
        'security/detect-new-buffer': 'error',
        // These have too many false positives even in strict mode
        'security/detect-no-csrf-before-method-override': 'off',
        'security/detect-non-literal-fs-filename': 'error',
        'security/detect-non-literal-require': 'error',
        'security/detect-object-injection': 'off',
        'security/detect-possible-timing-attacks': 'off',
        'security/detect-pseudoRandomBytes': 'off',
        'security/detect-unsafe-regex': 'error',
      },
    },

    // Promise plugin - per official recommended config levels
    // @see https://github.com/eslint-community/eslint-plugin-promise
    {
      plugins: {
        promise: promisePlugin,
      },
      rules: {
        // Error level (per recommended)
        'promise/always-return': ['error', { ignoreLastCallback: true }],
        // Off (not in recommended)
        'promise/avoid-new': 'off',
        'promise/catch-or-return': ['error', { allowFinally: true }],
        // Warn level (per recommended - these have legitimate use cases)
        'promise/no-callback-in-promise': 'warn',
        'promise/no-multiple-resolved': 'error',
        'promise/no-native': 'off',
        'promise/no-nesting': 'warn',
        'promise/no-new-statics': 'error',
        'promise/no-promise-in-callback': 'warn',
        'promise/no-return-in-finally': 'warn',
        'promise/no-return-wrap': 'error',
        'promise/param-names': 'error',
        'promise/prefer-await-to-callbacks': 'off',
        'promise/prefer-await-to-then': 'off',
        'promise/valid-params': 'error',
      },
    },

    // Main Rules - strict mode
    {
      rules: {
        'curly': ['error', 'all'],
        'dot-notation': 'off',
        'eqeqeq': ['error', 'always'],
        'no-alert': 'error',
        'no-console': ['error', { allow: ['error'] }],
        'no-debugger': 'error',
        'no-eval': 'error',
        'no-implied-eval': 'error',
        'no-param-reassign': 'error',
        'no-promise-executor-return': ['error', { allowVoid: true }],
        'no-return-assign': 'error',
        'no-sequences': 'error',
        'no-throw-literal': 'error',
        'no-unmodified-loop-condition': 'error',
        'no-useless-concat': 'error',
        'no-var': 'error',
        'node/prefer-global/process': 'off',
        'prefer-const': 'error',
        'prefer-promise-reject-errors': 'error',
        'prefer-template': 'error',
        'radix': 'error',
        'regexp/no-unused-capturing-group': 'error',
        'require-atomic-updates': 'error',
        'style/brace-style': ['error', '1tbs'],
        'ts/ban-ts-comment': ['error', {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': false,
          'ts-nocheck': false,
        }],
        'ts/consistent-type-definitions': ['error', 'type'],
        // Per official docs: disallowTypeAnnotations defaults to false
        // import() type annotations are valid TypeScript
        'ts/consistent-type-imports': ['error', {
          disallowTypeAnnotations: false,
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        }],
        'ts/dot-notation': 'off',
        'ts/method-signature-style': ['error', 'property'],
        'ts/no-explicit-any': 'error',
        'ts/no-inferrable-types': 'error',
        'ts/no-namespace': 'error',
        'ts/no-non-null-asserted-optional-chain': 'error',
        'ts/no-non-null-assertion': 'error',
        'ts/no-unused-vars': ['error', {
          args: 'all',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          ignoreRestSiblings: false,
          vars: 'all',
          varsIgnorePattern: '^_',
        }],
        // Note: ts/prefer-nullish-coalescing and ts/prefer-optional-chain require type info
        // They are enabled in overridesTypeAware instead
        'unused-imports/no-unused-imports': 'error',
        'unused-imports/no-unused-vars': 'off',
      },
    },

    // Perfectionist - sort objects in src files EXCEPT TanStack hooks/routes directories
    {
      files: ['src/**/*.ts', 'src/**/*.tsx'],
      ignores: [
        '**/hooks/mutations/**',
        '**/hooks/queries/**',
        '**/routes/**',
        '**/lib/data/**',
      ],
      rules: {
        'perfectionist/sort-objects': 'error',
      },
    },

    // Config files override
    {
      files: ['*.config.ts', '*.config.mjs', '*.config.js'],
      rules: {
        'no-console': 'off',
      },
    },

    // Test files override - relax some rules for tests
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      rules: {
        'promise/always-return': 'off',
        'promise/catch-or-return': 'off',
        'promise/prefer-await-to-then': 'off',
        'ts/no-unsafe-argument': 'off',
        'ts/no-unsafe-assignment': 'off',
        'ts/no-unsafe-call': 'off',
        'ts/no-unsafe-member-access': 'off',
        'ts/no-unsafe-return': 'off',
        // Vitest rules - relaxed for test flexibility
        'vitest/no-conditional-in-test': 'off',
        'vitest/prefer-strict-equal': 'off',
        'vitest/prefer-to-be-falsy': 'off',
        'vitest/prefer-to-be-truthy': 'off',
        'vitest/require-hook': 'off',
        'vitest/require-top-level-describe': 'off',
      },
    },

  );

  return configs as Linter.Config[];
}

export default createConfig;
