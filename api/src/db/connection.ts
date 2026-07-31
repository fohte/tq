import { AsyncLocalStorage } from 'node:async_hooks'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '#db/schema'
import { DATABASE_URL } from '#env'

const client = postgres(DATABASE_URL)
const defaultDb = drizzle(client, { schema })

export type DbTransaction = Parameters<
  typeof defaultDb.transaction
>[0] extends (tx: infer T) => unknown
  ? T
  : never

// Lets tests bind a per-test transaction to `db` scoped to that test's async
// execution context, instead of a shared module variable that would race
// when multiple test files run in parallel.
export const dbContext = new AsyncLocalStorage<
  typeof defaultDb | DbTransaction
>()

export const db: typeof defaultDb = new Proxy(defaultDb, {
  get(target, prop) {
    const current = dbContext.getStore() ?? target
    const value: unknown = Reflect.get(current, prop)
    return typeof value === 'function'
      ? (value.bind(current) as unknown)
      : value
  },
})
