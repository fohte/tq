import { fileURLToPath } from 'node:url'

import { DATABASE_URL } from '@api/env'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function setup() {
  const client = postgres(DATABASE_URL, { max: 1 })
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })

  await client.end()
}
