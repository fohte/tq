import { ok } from 'neverthrow'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { buildNextTaskData, computeNextDate } from '#services/recurrence'

describe('computeNextDate', () => {
  describe('daily', () => {
    it('advances by 1 day with interval=1', () => {
      expect(
        computeNextDate('2026-03-22', {
          type: 'daily',
          interval: 1,
        }),
      ).toEqual(ok('2026-03-23'))
    })

    it('advances by N days with interval=N', () => {
      expect(
        computeNextDate('2026-03-22', {
          type: 'daily',
          interval: 3,
        }),
      ).toEqual(ok('2026-03-25'))
    })

    it('crosses month boundary', () => {
      expect(
        computeNextDate('2026-03-31', {
          type: 'daily',
          interval: 1,
        }),
      ).toEqual(ok('2026-04-01'))
    })
  })

  describe('weekly', () => {
    it('finds next matching day in same week', () => {
      // 2026-03-22 is a Sunday (day 0)
      expect(
        computeNextDate('2026-03-22', {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        }),
      ).toEqual(ok('2026-03-23')) // Monday
    })

    it('wraps to next week when no remaining days', () => {
      // 2026-03-27 is a Friday (day 5)
      expect(
        computeNextDate('2026-03-27', {
          type: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
        }),
      ).toEqual(ok('2026-03-30')) // Next Monday
    })

    it('skips weeks with interval > 1', () => {
      // 2026-03-23 is Monday (day 1), interval=2, daysOfWeek=[1]
      // No remaining days this week (Monday is the only day and it's the base)
      expect(
        computeNextDate('2026-03-23', {
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1],
        }),
      ).toEqual(ok('2026-04-06')) // 2 weeks later Monday
    })

    it('finds remaining day in current week with interval > 1', () => {
      // 2026-03-23 is Monday (day 1), interval=2, daysOfWeek=[1, 3, 5]
      // Should return Wednesday (day 3) of the same week, not jump 2 weeks
      expect(
        computeNextDate('2026-03-23', {
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3, 5],
        }),
      ).toEqual(ok('2026-03-25')) // Wednesday of same week
    })

    it('skips to interval-th week when no remaining days with interval > 1', () => {
      // 2026-03-27 is Friday (day 5), interval=2, daysOfWeek=[1, 3, 5]
      // No remaining days this week, skip 2 weeks to Monday
      expect(
        computeNextDate('2026-03-27', {
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3, 5],
        }),
      ).toEqual(ok('2026-04-06')) // Monday 2 weeks later
    })

    it('advances by interval weeks when no daysOfWeek', () => {
      expect(
        computeNextDate('2026-03-22', {
          type: 'weekly',
          interval: 1,
        }),
      ).toEqual(ok('2026-03-29'))
    })
  })

  describe('monthly', () => {
    it('advances by 1 month', () => {
      expect(
        computeNextDate('2026-03-15', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 15,
        }),
      ).toEqual(ok('2026-04-15'))
    })

    it('clamps to end of shorter month', () => {
      expect(
        computeNextDate('2026-01-31', {
          type: 'monthly',
          interval: 1,
          dayOfMonth: 31,
        }),
      ).toEqual(ok('2026-02-28'))
    })

    it('advances by multiple months', () => {
      expect(
        computeNextDate('2026-03-15', {
          type: 'monthly',
          interval: 2,
          dayOfMonth: 15,
        }),
      ).toEqual(ok('2026-05-15'))
    })

    it('uses base date day when dayOfMonth is not specified', () => {
      expect(
        computeNextDate('2026-03-10', {
          type: 'monthly',
          interval: 1,
        }),
      ).toEqual(ok('2026-04-10'))
    })
  })

  describe('custom', () => {
    it('behaves like daily', () => {
      expect(
        computeNextDate('2026-03-22', {
          type: 'custom',
          interval: 5,
        }),
      ).toEqual(ok('2026-03-27'))
    })
  })
})

describe('buildNextTaskData', () => {
  const baseTask = {
    id: 'task-1',
    number: 1,
    title: 'Daily standup',
    description: 'Morning standup meeting',
    status: 'completed' as const,
    context: 'work' as const,
    startDate: null,
    dueDate: '2026-03-22',
    estimatedMinutes: 15,
    parentId: null,
    projectId: 'proj-1',
    recurrenceRuleId: 'rule-1',
    createdAt: new Date('2026-03-22T00:00:00Z'),
    updatedAt: new Date('2026-03-22T00:00:00Z'),
  }

  const baseRule = {
    id: 'rule-1',
    type: 'daily' as const,
    interval: 1,
    daysOfWeek: null,
    dayOfMonth: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }

  it('builds the next task data from a completed task', () => {
    expect(buildNextTaskData(baseTask, baseRule)).toEqual(
      ok({
        title: 'Daily standup',
        description: 'Morning standup meeting',
        status: 'todo',
        startDate: null,
        dueDate: '2026-03-23',
        estimatedMinutes: 15,
        parentId: null,
        projectId: 'proj-1',
        recurrenceRuleId: 'rule-1',
        context: 'work',
      }),
    )
  })

  it('shifts startDate by the same offset when both dates exist', () => {
    const task = {
      ...baseTask,
      startDate: '2026-03-20',
      dueDate: '2026-03-22',
    }
    // dueDate offset is 2 days (22 - 20), next due is 23, so start = 21
    expect(buildNextTaskData(task, baseRule)).toEqual(
      ok({
        title: 'Daily standup',
        description: 'Morning standup meeting',
        status: 'todo',
        startDate: '2026-03-21',
        dueDate: '2026-03-23',
        estimatedMinutes: 15,
        parentId: null,
        projectId: 'proj-1',
        recurrenceRuleId: 'rule-1',
        context: 'work',
      }),
    )
  })

  it('uses today as base when task has no dueDate', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-03-22T12:00:00Z'))

    const task = { ...baseTask, dueDate: null }
    // Should be tomorrow (today + 1 for daily interval 1)
    expect(buildNextTaskData(task, baseRule)).toEqual(
      ok({
        title: 'Daily standup',
        description: 'Morning standup meeting',
        status: 'todo',
        startDate: null,
        dueDate: '2026-03-23',
        estimatedMinutes: 15,
        parentId: null,
        projectId: 'proj-1',
        recurrenceRuleId: 'rule-1',
        context: 'work',
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })
})
