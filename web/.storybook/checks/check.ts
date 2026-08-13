// Shared contract for the story checks wired up in vitest.setup.ts: each
// check resets its own state before a story runs and asserts on it after.
export type StorybookCheck = {
  reset: () => void
  assert: () => void
}

export function throwIfNotEmpty(urls: string[], message: string): void {
  if (urls.length === 0) return
  const list = urls.join('\n')
  urls.length = 0
  throw new Error(`${message}:\n${list}`)
}
