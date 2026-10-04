import { AsyncLocalStorage } from 'node:async_hooks'

import type { DbContextValue } from '#db/connection'

const storage = new AsyncLocalStorage<DbContextValue>()

// Lets tests bind a per-test transaction without exposing AsyncLocalStorage's
// broader context mutation methods to production code.
export const dbContext = Object.freeze({
  getStore: () => storage.getStore(),
  run: <T>(store: DbContextValue, callback: () => T): T =>
    storage.run(store, callback),
})
