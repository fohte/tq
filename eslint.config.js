import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'

// Files allowed to use throw/try-catch and to leave a neverthrow Result
// unconsumed. Every other api/src file must satisfy the rule with zero
// exceptions.
const API_INTEROP_BOUNDARY_FILES = [
  // Throws at module-eval time, before the Hono app (and its app.onError
  // Sentry hook) exists, so there's no Result to return to.
  'api/src/env.ts',
  // Its firstOrThrow is still called by routes not yet migrated to
  // Result (e.g. schedules.ts); firstOrErr is the Result-returning
  // counterpart for migrated callers.
  'api/src/lib/drizzle-utils.ts',
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
