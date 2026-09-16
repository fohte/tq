import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Spelled out (matching Vitest's own default) so knip's static analysis
    // of this file can resolve test entry files; Vitest's own runtime
    // behavior is unchanged.
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    environment: 'jsdom',
    // config.ts requires TQ_ORIGIN to be set (no shipped default); tests
    // don't talk to a real tq instance, so any origin works.
    env: { TQ_ORIGIN: 'https://tq.example.test' },
  },
})
