import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from '#db/schema'
import { DATABASE_URL } from '#env'

const client = postgres(DATABASE_URL)
export const db = drizzle(client, { schema })

export type DbTransaction = Parameters<typeof db.transaction>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never
