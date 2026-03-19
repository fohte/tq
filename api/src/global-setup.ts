import { fileURLToPath } from 'node:url'

import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

export async function setup() {
  const databaseUrl =
    process.env['DATABASE_URL'] ?? 'postgresql://tq:tq@localhost:5432/tq_test'
  const client = postgres(databaseUrl, { max: 1 })
  const db = drizzle(client)

  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)),
  })

  await client.end()
}
