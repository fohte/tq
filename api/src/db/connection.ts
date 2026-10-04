import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import { dbContext } from '#db/context'
import * as schema from '#db/schema'
import { DATABASE_URL } from '#env'

const client = postgres(DATABASE_URL)
const defaultDb = drizzle(client, { schema })

export type DbTransaction = Parameters<
  typeof defaultDb.transaction
>[0] extends (tx: infer T) => unknown
  ? T
  : never
export type DbContextValue = typeof defaultDb | DbTransaction

export const db: typeof defaultDb = new Proxy(defaultDb, {
  get(target, prop) {
    const current = dbContext.getStore() ?? target
    const value: unknown = Reflect.get(current, prop)
    return typeof value === 'function'
      ? (value.bind(current) as unknown)
      : value
  },
})
