<<<<<<< before updating
import storybook from 'eslint-plugin-storybook'

import { mainConfig, typescriptConfig } from '@fohte/eslint-config'
=======
import { config } from '@fohte/eslint-config'
>>>>>>> after updating

export default config(
  { typescript: { typeChecked: true } },
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
]

export default config
=======
)
>>>>>>> after updating
