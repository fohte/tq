import * as schema from '@api/db/schema'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { afterAll, afterEach, beforeAll } from 'vitest'

const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ??
  'postgresql://tq:tq@localhost:5432/tq_test'

const migrationClient = postgres(TEST_DATABASE_URL, { max: 1 })
const migrationDb = drizzle(migrationClient)

const queryClient = postgres(TEST_DATABASE_URL)
export const testDb = drizzle(queryClient, { schema })

const tableNames = [
  'today_tasks',
  'time_blocks',
  'task_comments',
  'task_pages',
  'task_labels',
  'tasks',
  'labels',
  'schedules',
  'recurrence_rules',
  'projects',
  'oauth_tokens',
  'images',
] as const

export function setupTestDb() {
  beforeAll(async () => {
    await migrate(migrationDb, {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    })
  })

  afterEach(async () => {
    for (const table of tableNames) {
      await testDb.execute(sql.raw(`DELETE FROM "${table}"`))
    }
  })

  afterAll(async () => {
    await queryClient.end()
    await migrationClient.end()
  })
}
