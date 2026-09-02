import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

// tq has exactly one user, so scheduling preferences need no owning key.
// The primary key is pinned to this literal id and enforced by a CHECK
// constraint so at most one row can ever exist.
export const SCHEDULING_SETTINGS_ID = 'singleton'

export const schedulingSettings = pgTable(
  'scheduling_settings',
  {
    id: text('id').primaryKey().default(SCHEDULING_SETTINGS_ID),
    // "HH:MM" local time-of-day, same text format as schedules.startTime/endTime.
    workingHoursStart: text('working_hours_start').notNull().default('09:00'),
    workingHoursEnd: text('working_hours_end').notNull().default('19:00'),
    minimumBlockMinutes: integer('minimum_block_minutes').notNull().default(30),
    autoRescheduleOnGcalChange: boolean('auto_reschedule_on_gcal_change')
      .notNull()
      .default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'scheduling_settings_singleton_check',
      sql`${table.id} = 'singleton'`,
    ),
    check(
      'scheduling_settings_working_hours_order_check',
      sql`${table.workingHoursStart} < ${table.workingHoursEnd}`,
    ),
    check(
      'scheduling_settings_minimum_block_minutes_positive_check',
      sql`${table.minimumBlockMinutes} > 0`,
    ),
    check(
      'scheduling_settings_working_hours_format_check',
      sql`${table.workingHoursStart} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND ${table.workingHoursEnd} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
)
