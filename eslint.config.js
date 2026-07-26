import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'

export default config(
  {
    typescript: { typeChecked: true },
    errorHandling: {},
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
