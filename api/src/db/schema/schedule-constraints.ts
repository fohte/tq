import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

import { schedules } from '#db/schema/core'

export const scheduleConstraints = pgTable(
  'schedule_constraints',
  {
    scheduleId: text('schedule_id')
      .primaryKey()
      .references(() => schedules.id, { onDelete: 'cascade' }),
    weeklyMin: integer('weekly_min'),
    weeklyMax: integer('weekly_max'),
    weeklyTarget: integer('weekly_target'),
    maxConsecutiveDays: integer('max_consecutive_days'),
    windowStart: text('window_start'),
    windowEnd: text('window_end'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      'schedule_constraints_weekly_min_check',
      sql`${table.weeklyMin} BETWEEN 0 AND 7`,
    ),
    check(
      'schedule_constraints_weekly_max_check',
      sql`${table.weeklyMax} BETWEEN 0 AND 7`,
    ),
    check(
      'schedule_constraints_weekly_range_check',
      sql`${table.weeklyMin} <= ${table.weeklyMax}`,
    ),
    check(
      'schedule_constraints_weekly_target_check',
      sql`${table.weeklyTarget} BETWEEN coalesce(${table.weeklyMin}, 0) AND coalesce(${table.weeklyMax}, 7)`,
    ),
    check(
      'schedule_constraints_max_consecutive_days_check',
      sql`${table.maxConsecutiveDays} >= 1`,
    ),
    check(
      'schedule_constraints_window_pair_check',
      sql`(${table.windowStart} IS NULL) = (${table.windowEnd} IS NULL)`,
    ),
    check(
      'schedule_constraints_window_start_format_check',
      sql`${table.windowStart} IS NULL OR ${table.windowStart} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    check(
      'schedule_constraints_window_end_format_check',
      sql`${table.windowEnd} IS NULL OR ${table.windowEnd} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
  ],
)

export const scheduleConstraintWeekdays = pgTable(
  'schedule_constraint_weekdays',
  {
    scheduleId: text('schedule_id').notNull(),
    dayOfWeek: integer('day_of_week').notNull(),
    preference: text('preference').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.scheduleId, table.dayOfWeek] }),
    foreignKey({
      columns: [table.scheduleId],
      foreignColumns: [scheduleConstraints.scheduleId],
      name: 'schedule_constraint_weekdays_constraint_fk',
    }).onDelete('cascade'),
    check(
      'schedule_constraint_weekdays_day_of_week_check',
      sql`${table.dayOfWeek} BETWEEN 0 AND 6`,
    ),
    check(
      'schedule_constraint_weekdays_preference_check',
      sql`${table.preference} IN ('preferred', 'if_free', 'reserve', 'excluded')`,
    ),
  ],
)
