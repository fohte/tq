import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pin TQ_AUTHOR/TQ_CONTEXT so tests exercising their defaults don't
    // silently pick up the host shell's ambient config.
    env: { TQ_AUTHOR: '', TQ_CONTEXT: '' },
  },
})
