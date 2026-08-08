import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Pin TQ_AUTHOR so tests exercising the --author default don't silently
    // pick up the host shell's ambient config.
    env: { TQ_AUTHOR: '' },
  },
})
