import { expandScheduleForDate } from '@api/routes/schedule-expansion'
import { describe, expect, it } from 'vitest'

function makeSchedule(
  overrides: Partial<{
    id: string
    title: string
    startTime: string
    endTime: string
    recurrenceRuleId: string | null
    context: 'work' | 'personal' | 'dev'
    color: string | null
    createdAt: Date
    updatedAt: Date
  }> = {},
) {
  const now = new Date()
  return {
    id: 'sched-1',
    title: 'Test Schedule',
    startTime: '09:00',
    endTime: '10:00',
    recurrenceRuleId: null,
    context: 'personal' as const,
    color: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function makeRule(
  overrides: Partial<{
    id: string
    type: 'daily' | 'weekly' | 'monthly' | 'custom'
    interval: number
    daysOfWeek: number[] | null
    dayOfMonth: number | null
    createdAt: Date
    updatedAt: Date
  }> = {},
) {
  const now = new Date()
  return {
    id: 'rule-1',
    type: 'daily' as const,
    interval: 1,
    daysOfWeek: null,
    dayOfMonth: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('expandScheduleForDate', () => {
  describe('same-day schedule', () => {
    it('returns a single block for a normal schedule', () => {
      const schedule = makeSchedule({ startTime: '09:00', endTime: '10:00' })
      const blocks = expandScheduleForDate(schedule, null, '2026-03-22')

      expect(blocks).toHaveLength(1)
      expect(blocks[0]).toEqual({
        scheduleId: 'sched-1',
        title: 'Test Schedule',
        start: '2026-03-22T09:00:00',
        end: '2026-03-22T10:00:00',
        context: 'personal',
        color: null,
      })
    })
  })

  describe('cross-midnight schedule', () => {
    it('returns start portion on the start date', () => {
      const schedule = makeSchedule({ startTime: '23:00', endTime: '07:00' })
      const blocks = expandScheduleForDate(schedule, null, '2026-03-22')

      // Should have start portion (23:00->midnight) and end portion (midnight->07:00)
      // because the previous day (03-21) with no rule also matches
      expect(blocks).toHaveLength(2)

      const startBlock = blocks.find((b) => b.start.includes('T23:00'))
      expect(startBlock).toEqual({
        scheduleId: 'sched-1',
        title: 'Test Schedule',
        start: '2026-03-22T23:00:00',
        end: '2026-03-23T00:00:00',
        context: 'personal',
        color: null,
      })

      const endBlock = blocks.find((b) => b.start.includes('T00:00'))
      expect(endBlock).toEqual({
        scheduleId: 'sched-1',
        title: 'Test Schedule',
        start: '2026-03-22T00:00:00',
        end: '2026-03-22T07:00:00',
        context: 'personal',
        color: null,
      })
    })
  })

  describe('weekly recurrence', () => {
    it('returns blocks only on matching days of week', () => {
      const schedule = makeSchedule({
        startTime: '18:00',
        endTime: '19:00',
        recurrenceRuleId: 'rule-1',
      })
      // 2026-03-23 is Monday (day 1)
      const rule = makeRule({
        type: 'weekly',
        daysOfWeek: [1, 3, 5], // Mon, Wed, Fri
      })

      const mondayBlocks = expandScheduleForDate(schedule, rule, '2026-03-23')
      expect(mondayBlocks).toHaveLength(1)

      // 2026-03-24 is Tuesday (day 2) - not in daysOfWeek
      const tuesdayBlocks = expandScheduleForDate(schedule, rule, '2026-03-24')
      expect(tuesdayBlocks).toHaveLength(0)

      // 2026-03-25 is Wednesday (day 3)
      const wednesdayBlocks = expandScheduleForDate(
        schedule,
        rule,
        '2026-03-25',
      )
      expect(wednesdayBlocks).toHaveLength(1)
    })

    it('handles cross-midnight schedule with weekly rule', () => {
      const schedule = makeSchedule({
        startTime: '23:00',
        endTime: '07:00',
        recurrenceRuleId: 'rule-1',
      })
      // Rule: Mon, Wed, Fri
      const rule = makeRule({
        type: 'weekly',
        daysOfWeek: [1, 3, 5],
      })

      // 2026-03-23 is Monday - should have start portion
      const mondayBlocks = expandScheduleForDate(schedule, rule, '2026-03-23')
      // Monday has start portion (23:00->midnight)
      // Previous day (Sunday=0) is NOT in daysOfWeek, so no end portion
      expect(mondayBlocks).toHaveLength(1)
      expect(mondayBlocks[0]!.start).toBe('2026-03-23T23:00:00')

      // 2026-03-24 is Tuesday - not in daysOfWeek
      // But Monday (previous day) IS in daysOfWeek, so end portion should appear
      const tuesdayBlocks = expandScheduleForDate(schedule, rule, '2026-03-24')
      expect(tuesdayBlocks).toHaveLength(1)
      expect(tuesdayBlocks[0]!.start).toBe('2026-03-24T00:00:00')
      expect(tuesdayBlocks[0]!.end).toBe('2026-03-24T07:00:00')
    })
  })

  describe('monthly recurrence', () => {
    it('returns blocks only on the matching day of month', () => {
      const schedule = makeSchedule({
        startTime: '10:00',
        endTime: '11:00',
        recurrenceRuleId: 'rule-1',
      })
      const rule = makeRule({
        type: 'monthly',
        dayOfMonth: 15,
      })

      const onDay = expandScheduleForDate(schedule, rule, '2026-03-15')
      expect(onDay).toHaveLength(1)

      const offDay = expandScheduleForDate(schedule, rule, '2026-03-16')
      expect(offDay).toHaveLength(0)
    })
  })

  describe('daily recurrence', () => {
    it('returns blocks every day', () => {
      const schedule = makeSchedule({
        startTime: '06:00',
        endTime: '07:00',
        recurrenceRuleId: 'rule-1',
      })
      const rule = makeRule({ type: 'daily' })

      const blocks = expandScheduleForDate(schedule, rule, '2026-03-22')
      expect(blocks).toHaveLength(1)
    })
  })
})
