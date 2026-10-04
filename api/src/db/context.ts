import { AsyncLocalStorage } from 'node:async_hooks'

import type { DbContextValue } from '#db/connection'

// Lets tests bind a per-test transaction to `db` scoped to that test's async
// execution context, instead of a shared module variable that would race
// when multiple test files run in parallel.
export const dbContext = new AsyncLocalStorage<DbContextValue>()
