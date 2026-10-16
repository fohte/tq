import { readFile } from 'node:fs/promises'

import postgres from 'postgres'
import { afterAll, expect, it } from 'vitest'

import { DATABASE_URL } from '#env'

const client = postgres(DATABASE_URL, { max: 1 })

afterAll(async () => {
  await client.end()
})

it('preserves existing schedule dates, times, and recurrence during migration, including legacy out-of-range times', async () => {
  const schemaName =
    'schedule_revisions_migration_' + crypto.randomUUID().replaceAll('-', '')
  const migrationSql = await readFile(
    new URL('../../drizzle/0063_tough_captain_britain.sql', import.meta.url),
    'utf8',
  )
  const statements = migrationSql
    .replaceAll('"public".', '"' + schemaName + '".')
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)

  const migratedRows = await client.begin(async (tx) => {
    await tx.unsafe('CREATE SCHEMA "' + schemaName + '"')
    await tx.unsafe('SET LOCAL search_path TO "' + schemaName + '"')
    await tx.unsafe(`
      CREATE TABLE recurrence_rules (
        id text PRIMARY KEY,
        type text NOT NULL
      )
    `)
    await tx.unsafe(`
      CREATE TABLE schedules (
        id text PRIMARY KEY,
        title text NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        start_date date NOT NULL,
        recurrence_rule_id text,
        context text NOT NULL DEFAULT 'personal',
        color text,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT schedules_recurrence_rule_id_recurrence_rules_id_fk
          FOREIGN KEY (recurrence_rule_id) REFERENCES recurrence_rules(id)
          ON DELETE SET NULL
      )
    `)
    await tx.unsafe(
      'CREATE INDEX idx_schedules_recurrence_rule_id ON schedules(recurrence_rule_id)',
    )
    await tx.unsafe(
      "INSERT INTO recurrence_rules (id, type) VALUES ('legacy-rule', 'daily')",
    )
    await tx.unsafe(`
      INSERT INTO schedules (
        id, title, start_time, end_time, start_date, recurrence_rule_id,
        context, color, created_at, updated_at
      ) VALUES
        (
          'legacy-boundary-times', 'Legacy boundary times', '24:00', '10:60',
          '2041-06-03', NULL, 'personal', NULL,
          '2041-01-03T00:00:00Z', '2041-01-03T00:00:00Z'
        ),
        (
          'legacy-once', 'One-off', '10:00', '11:00', '2041-06-02', NULL,
          'personal', NULL, '2041-01-01T00:00:00Z', '2041-01-01T00:00:00Z'
        ),
        (
          'legacy-recurring', 'Daily', '08:15', '09:30', '2041-06-01',
          'legacy-rule', 'work', NULL,
          '2041-01-02T00:00:00Z', '2041-01-02T00:00:00Z'
        )
    `)

    for (const statement of statements) {
      await tx.unsafe(statement)
    }

    const rows = await tx.unsafe<
      {
        schedule_id: string
        end_date: string | null
        effective_from: string
        start_time: string
        end_time: string
        recurrence_rule_id: string | null
        recurrence_type: string | null
      }[]
    >(`
      SELECT
        schedules.id AS schedule_id,
        schedules.end_date::text AS end_date,
        schedule_revisions.effective_from::text AS effective_from,
        schedule_revisions.start_time,
        schedule_revisions.end_time,
        schedule_revisions.recurrence_rule_id,
        recurrence_rules.type AS recurrence_type
      FROM schedules
      JOIN schedule_revisions
        ON schedule_revisions.schedule_id = schedules.id
      LEFT JOIN recurrence_rules
        ON recurrence_rules.id = schedule_revisions.recurrence_rule_id
      ORDER BY schedules.id
    `)

    await tx.unsafe('DROP SCHEMA "' + schemaName + '" CASCADE')

    return rows
  })

  expect(migratedRows).toEqual([
    {
      schedule_id: 'legacy-boundary-times',
      end_date: null,
      effective_from: '2041-06-03',
      start_time: '24:00',
      end_time: '10:60',
      recurrence_rule_id: null,
      recurrence_type: null,
    },
    {
      schedule_id: 'legacy-once',
      end_date: null,
      effective_from: '2041-06-02',
      start_time: '10:00',
      end_time: '11:00',
      recurrence_rule_id: null,
      recurrence_type: null,
    },
    {
      schedule_id: 'legacy-recurring',
      end_date: null,
      effective_from: '2041-06-01',
      start_time: '08:15',
      end_time: '09:30',
      recurrence_rule_id: 'legacy-rule',
      recurrence_type: 'daily',
    },
  ])
})
