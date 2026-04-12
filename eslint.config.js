import { config } from '@fohte/eslint-config'
import storybook from 'eslint-plugin-storybook'

export default config(
  { typescript: { typeChecked: true } },
<<<<<<< before updating
=======
  ...storybook.configs['flat/recommended'],
>>>>>>> after updating
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
<<<<<<< before updating
  ...storybook.configs['flat/recommended'],
=======
  // .storybook/ is outside src/ where @ alias is unavailable
  {
    files: ['**/.storybook/**/*.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
>>>>>>> after updating
)
