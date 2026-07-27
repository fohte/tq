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
  // vite.config.ts is loaded through Vite's own esbuild-based config loader,
  // which doesn't resolve the package.json "imports" field, unlike the
  // Rollup pipeline that bundles the app itself.
  {
    files: ['web/vite.config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
)
