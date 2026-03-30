import { DATABASE_URL } from '@api/env.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const client = postgres(DATABASE_URL, { max: 1 })
const db = drizzle(client)

await migrate(db, { migrationsFolder: './drizzle' })
await client.end()
