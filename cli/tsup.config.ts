import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Keep in sync with the node version in .mise.toml.
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
  // Bundle first-party code; keep node_modules external (hono, commander) so
  // they resolve from cli's own node_modules at runtime.
  skipNodeModulesBundle: true,
  // package.json subpath imports (the "#*" entries in cli/package.json)
  // aren't relative specifiers, so skipNodeModulesBundle treats them like
  // node_modules packages and leaves them external. Force them to bundle
  // since dist/ never ships src/.
  noExternal: [/^#/],
})
