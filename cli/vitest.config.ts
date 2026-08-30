import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Spelled out (matching Vitest's own default) so knip's static analysis
    // of this file can resolve test entry files; Vitest's own runtime
    // behavior is unchanged.
    include: ['**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    // Pin TQ_AUTHOR/TQ_CONTEXT so tests exercising their defaults don't
    // silently pick up the host shell's ambient config.
    env: { TQ_AUTHOR: '', TQ_CONTEXT: '' },
  },
})
