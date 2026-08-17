import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/db/migrate.ts'],
  format: ['esm'],
  // Keep in sync with the node version in .mise.toml.
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  // Bundle first-party code; keep node_modules external so
  // @opentelemetry/auto-instrumentations-node's module-patching hook still
  // applies to the real package in node_modules instead of a bundled copy.
  skipNodeModulesBundle: true,
<<<<<<< before updating
  // package.json subpath imports (the "#*" entries in api/package.json)
  // aren't relative specifiers, so skipNodeModulesBundle treats them like
  // node_modules packages and leaves them external. Force them to bundle
  // since dist/ never ships src/.
||||||| last update
=======
  // skipNodeModulesBundle treats subpath imports (`#foo`) as external too,
  // leaving `./src/*.ts` specifiers unresolved in a runtime image that only
  // ships dist/. Force-bundle them so dist stays self-contained.
>>>>>>> after updating
  noExternal: [/^#/],
})
