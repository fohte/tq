import { readFile } from 'node:fs/promises'

import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

import { DATABASE_URL } from '#env'

const client = postgres(DATABASE_URL, { max: 1 })

afterAll(async () => {
  await client.end()
})

it('migrates task priorities and saved view filters by value', async () => {
  const schemaName =
    'priority_migration_' + crypto.randomUUID().replaceAll('-', '')
  const migrationSql = await readFile(
    new URL('../../drizzle/0066_concerned_shinobi_shaw.sql', import.meta.url),
    'utf8',
  )
  const statements = migrationSql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  const migratedRows = await client.begin(async (tx) => {
    await tx.unsafe('CREATE SCHEMA "' + schemaName + '"')
    await tx.unsafe('SET LOCAL search_path TO "' + schemaName + '"')
    await tx.unsafe(`
      CREATE TABLE tasks (
        id text PRIMARY KEY,
        commitment text NOT NULL
      )
    `)
    await tx.unsafe(`
      CREATE TABLE saved_views (
        id text PRIMARY KEY,
        query text NOT NULL
      )
    `)
    await tx.unsafe(`
      INSERT INTO tasks (id, commitment) VALUES
        ('one', 'inbox'),
        ('two', 'active'),
        ('three', 'someday')
    `)
    await tx.unsafe(`
      INSERT INTO saved_views (id, query) VALUES
        ('one', 'commitment:inbox'),
        ('two', 'commitment:active'),
        ('three', 'commitment:someday'),
        ('four', 'commitment:inbox commitment:active commitment:someday commitment:other commitment:inbox, "commitment:active"')
    `)

    for (const statement of statements) {
      await tx.unsafe(statement)
    }

    const tasks = await tx.unsafe<
      { id: string; commitment: string; priority: number | null }[]
    >('SELECT id, commitment, priority FROM tasks ORDER BY id')
    const savedViews = await tx.unsafe<{ id: string; query: string }[]>(
      'SELECT id, query FROM saved_views ORDER BY id',
    )

    await tx.unsafe('DROP SCHEMA "' + schemaName + '" CASCADE')

    return { tasks, savedViews }
  })

  expect(migratedRows).toEqual({
    tasks: [
      { id: 'one', commitment: 'inbox', priority: null },
      { id: 'three', commitment: 'someday', priority: -1 },
      { id: 'two', commitment: 'active', priority: 0 },
    ],
    savedViews: [
      {
        id: 'four',
        query:
          'priority:none priority:0 priority:-1 commitment:other commitment:inbox, "priority:0"',
      },
      { id: 'one', query: 'priority:none' },
      { id: 'three', query: 'priority:-1' },
      { id: 'two', query: 'priority:0' },
    ],
  })
})
