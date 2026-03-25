import * as schema from '@api/db/schema.js'
import { DATABASE_URL } from '@api/env.js'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(DATABASE_URL)
export const db = drizzle(client, { schema })
