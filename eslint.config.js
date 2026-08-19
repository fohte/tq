import { config } from '@fohte/eslint-config'

<<<<<<< before updating
export default config(
  {
    typescript: { typeChecked: true },
    errorHandling: {},
    // Keep web/ on design tokens (see docs/design-system.md) instead of
    // Tailwind arbitrary values.
    tailwind: {
      files: ['web/**/*.ts{,x}'],
      cssConfigPath: 'web/src/index.css',
    },
  },
  {
    ignores: ['**/routeTree.gen.ts'],
  },
  ...storybook.configs['flat/recommended'],
  // vite.config.ts/vitest.config.ts are loaded through Vite's own
  // esbuild-based config loader, which doesn't resolve the package.json
  // "imports" field, unlike the Rollup pipeline that bundles the app itself.
  {
    files: ['web/vite.config.ts', 'web/vitest.config.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
)
||||||| last update
export default config(
  {
    typescript: { typeChecked: true },
    errorHandling: {},
  },
  ...storybook.configs['flat/recommended'],
)
=======
export default config({
  typescript: { typeChecked: true },
  errorHandling: {},
})
>>>>>>> after updating
