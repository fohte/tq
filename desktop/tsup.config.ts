import { defineConfig } from 'tsup'

// Importing this validates TQ_ORIGIN, so a build without it fails here.
import { TQ_ORIGIN } from '#config'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  // Keep in sync with the node version bundled in Electron (Electron 44 → Node 24).
  target: 'node24',
  platform: 'node',
  outDir: 'dist',
  clean: true,
  define: { 'process.env.TQ_ORIGIN': JSON.stringify(TQ_ORIGIN) },
  // `electron` resolves to the runtime's built-in module, never the npm
  // package (whose default export is just the binary path). Everything else
  // is bundled because runtime libraries live in devDependencies, so the
  // packaged app needs no node_modules.
  external: ['electron'],
})
