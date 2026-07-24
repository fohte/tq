import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'

// Files allowed to use throw/try-catch and to leave a neverthrow Result
// unconsumed: process bootstrap (env, DB connection/migration, server
// entrypoint) and the Hono/MCP request-handling layer, whose own
// throw/reject contract is the boundary api/src/app.ts's onError hooks into
// to report to Sentry. api/src/lib/drizzle-utils.ts is included because its
// firstOrThrow helper is a deliberate, always-visible throw-on-missing-row
// contract used throughout that boundary layer.
const API_INTEROP_BOUNDARY_FILES = [
  'api/src/env.ts',
  'api/src/bootstrap.ts',
  'api/src/index.ts',
  'api/src/testing.ts',
  'api/src/global-setup.ts',
  'api/src/lib/drizzle-utils.ts',
  'api/src/db/**/*.ts',
  'api/src/routes/**/*.ts',
]

export default config(
  {
    typescript: { typeChecked: true },
    errorHandling: { interopBoundaryFiles: API_INTEROP_BOUNDARY_FILES },
  },
  {
    ignores: ['**/routeTree.gen.ts'],
  },
  ...storybook.configs['flat/recommended'],
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['./*', '../*'],
              message:
                'Please use absolute imports instead of relative imports.',
            },
          ],
        },
      ],
    },
  },
  // .storybook/, vite.config.ts, and vitest.config.ts are outside src/ where @ alias is unavailable
  {
    files: [
      '**/.storybook/**/*.ts',
      '**/vite.config.ts',
      '**/vitest.config.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // errorHandling only targets api/src; the rest of the repo (web/, config
  // files at the root) keeps using throw/try-catch and never imports
  // neverthrow.
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['api/src/**/*.ts', 'api/src/**/*.tsx'],
    rules: {
      'no-restricted-syntax': 'off',
      'neverthrow/must-use-result': 'off',
    },
  },
)
