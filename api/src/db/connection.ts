import * as schema from '@api/db/schema.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const databaseUrl = process.env['DATABASE_URL']
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required')
}

const client = postgres(databaseUrl)
export const db = drizzle(client, { schema })
