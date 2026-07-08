import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'

export default config(
  { typescript: { typeChecked: true } },
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
  // .storybook/ and vite.config.ts are outside src/ where @ alias is unavailable
  {
    files: ['**/.storybook/**/*.ts', '**/vite.config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
  // e2e/ is a small, flat test package with no @ alias, so relative imports
  // between its config/fixture files are expected.
  {
    files: ['e2e/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
)
