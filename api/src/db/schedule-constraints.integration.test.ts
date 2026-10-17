import { asc, eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '#db/connection'
import {
  scheduleConstraints,
  scheduleConstraintWeekdays,
  schedules,
} from '#db/schema'
import { setupTestDb } from '#testing'

setupTestDb()

type ConstraintValues = Omit<
  typeof scheduleConstraints.$inferInsert,
  'scheduleId'
>

async function createScheduleId() {
  const scheduleId = crypto.randomUUID()
  await db.insert(schedules).values({ id: scheduleId, title: 'Schedule' })
  return scheduleId
}

async function getScheduleConstraintRows(scheduleId: string) {
  const constraints = await db
    .select({
      scheduleId: scheduleConstraints.scheduleId,
      weeklyMin: scheduleConstraints.weeklyMin,
      weeklyMax: scheduleConstraints.weeklyMax,
      weeklyTarget: scheduleConstraints.weeklyTarget,
      maxConsecutiveDays: scheduleConstraints.maxConsecutiveDays,
      windowStart: scheduleConstraints.windowStart,
      windowEnd: scheduleConstraints.windowEnd,
    })
    .from(scheduleConstraints)
    .where(eq(scheduleConstraints.scheduleId, scheduleId))
  const weekdays = await db
    .select({
      dayOfWeek: scheduleConstraintWeekdays.dayOfWeek,
      preference: scheduleConstraintWeekdays.preference,
    })
    .from(scheduleConstraintWeekdays)
    .where(eq(scheduleConstraintWeekdays.scheduleId, scheduleId))
    .orderBy(asc(scheduleConstraintWeekdays.dayOfWeek))

  return { constraints, weekdays }
}

async function sqlStateFor(operation: Promise<unknown>) {
  return operation.then(
    () => 'accepted',
    (error: unknown) => {
      const cause = error instanceof Error ? error.cause : error
      if (
        cause == null ||
        typeof cause !== 'object' ||
        !('code' in cause) ||
        typeof cause.code !== 'string'
      ) {
        return 'unknown'
      }
      return cause.code
    },
  )
}

async function insertInvalidConstraint(values: ConstraintValues) {
  const scheduleId = await createScheduleId()
  return sqlStateFor(
    db.insert(scheduleConstraints).values({ scheduleId, ...values }),
  )
}

const invalidConstraints: readonly {
  name: string
  values: ConstraintValues
}[] = [
  { name: 'negative weekly minimum', values: { weeklyMin: -1 } },
  { name: 'weekly maximum above seven', values: { weeklyMax: 8 } },
  {
    name: 'weekly minimum above the maximum',
    values: { weeklyMin: 4, weeklyMax: 3 },
  },
  {
    name: 'weekly target below its range',
    values: { weeklyMin: 3, weeklyMax: 5, weeklyTarget: 2 },
  },
  {
    name: 'weekly target above its range',
    values: { weeklyMin: 3, weeklyMax: 5, weeklyTarget: 6 },
  },
  {
    name: 'weekly target above seven without bounds',
    values: { weeklyTarget: 8 },
  },
  { name: 'zero consecutive days', values: { maxConsecutiveDays: 0 } },
  { name: 'one-sided time window', values: { windowStart: '08:00' } },
  {
    name: 'invalid window start',
    values: { windowStart: '24:00', windowEnd: '23:00' },
  },
  {
    name: 'invalid window end',
    values: { windowStart: '08:00', windowEnd: '8:00' },
  },
]

describe('schedule constraint database invariants', () => {
  it('stores valid weekly, consecutive-day, time-window, and weekday preferences', async () => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({
      scheduleId,
      weeklyMin: 3,
      weeklyMax: 4,
      weeklyTarget: 4,
      maxConsecutiveDays: 2,
      windowStart: '22:00',
      windowEnd: '23:30',
    })
    await db.insert(scheduleConstraintWeekdays).values([
      { scheduleId, dayOfWeek: 0, preference: 'preferred' },
      { scheduleId, dayOfWeek: 1, preference: 'if_free' },
      { scheduleId, dayOfWeek: 2, preference: 'reserve' },
      { scheduleId, dayOfWeek: 6, preference: 'excluded' },
    ])
    expect(await getScheduleConstraintRows(scheduleId)).toEqual({
      constraints: [
        {
          scheduleId,
          weeklyMin: 3,
          weeklyMax: 4,
          weeklyTarget: 4,
          maxConsecutiveDays: 2,
          windowStart: '22:00',
          windowEnd: '23:30',
        },
      ],
      weekdays: [
        { dayOfWeek: 0, preference: 'preferred' },
        { dayOfWeek: 1, preference: 'if_free' },
        { dayOfWeek: 2, preference: 'reserve' },
        { dayOfWeek: 6, preference: 'excluded' },
      ],
    })
  })

  it.each(invalidConstraints)('rejects $name', async ({ values }) => {
    expect(await insertInvalidConstraint(values)).toEqual('23514')
  })

  it.each([-1, 7])('rejects weekday number %i', async (dayOfWeek) => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({ scheduleId })

    expect(
      await sqlStateFor(
        db.insert(scheduleConstraintWeekdays).values({
          scheduleId,
          dayOfWeek,
          preference: 'preferred',
        }),
      ),
    ).toEqual('23514')
  })

  it('rejects weekday preferences outside the supported values', async () => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({ scheduleId })

    expect(
      await sqlStateFor(
        db.insert(scheduleConstraintWeekdays).values({
          scheduleId,
          dayOfWeek: 1,
          preference: 'sometimes',
        }),
      ),
    ).toEqual('23514')
  })

  it('allows only one constraint row per schedule', async () => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({ scheduleId })

    expect(
      await sqlStateFor(db.insert(scheduleConstraints).values({ scheduleId })),
    ).toEqual('23505')
  })

  it('allows only one preference for each schedule weekday', async () => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({ scheduleId })
    await db
      .insert(scheduleConstraintWeekdays)
      .values({ scheduleId, dayOfWeek: 1, preference: 'preferred' })

    expect(
      await sqlStateFor(
        db
          .insert(scheduleConstraintWeekdays)
          .values({ scheduleId, dayOfWeek: 1, preference: 'reserve' }),
      ),
    ).toEqual('23505')
  })

  it('cascades schedule deletion through constraints and weekday preferences', async () => {
    const scheduleId = await createScheduleId()
    await db.insert(scheduleConstraints).values({ scheduleId })
    await db
      .insert(scheduleConstraintWeekdays)
      .values({ scheduleId, dayOfWeek: 1, preference: 'reserve' })

    await db.delete(schedules).where(eq(schedules.id, scheduleId))
    expect(await getScheduleConstraintRows(scheduleId)).toEqual({
      constraints: [],
      weekdays: [],
    })
  })
})
