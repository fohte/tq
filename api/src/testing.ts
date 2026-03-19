import { db } from '@api/db/connection'
import { sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { afterEach, beforeAll } from 'vitest'

export function setupTestDb() {
  beforeAll(async () => {
    await migrate(db, {
      migrationsFolder: new URL('../drizzle', import.meta.url).pathname,
    })
  })

  afterEach(async () => {
    const res = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE 'drizzle_%'`,
    )
    const tables = (res as unknown as Array<{ tablename: string }>).map(
      (t) => `"${t.tablename}"`,
    )
    if (tables.length > 0) {
      await db.execute(
        sql.raw(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`),
      )
    }
  })
}
