import { defineConfig } from 'tsup'

import { sharedBuildConfig } from '#tsup-config'

export default defineConfig({
  ...sharedBuildConfig,
  entry: ['src/preload.ts'],
  format: ['cjs'],
  clean: false,
  outExtension: () => ({ js: '.cjs' }),
})
