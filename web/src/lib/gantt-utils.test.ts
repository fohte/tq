import type { ProjectTask } from '@web/hooks/use-projects'
import {
  buildGanttTasks,
  getScaleConfig,
  toDateOnlyString,
} from '@web/lib/gantt-utils'
import { describe, expect, it } from 'vitest'

const baseTask: ProjectTask = {
  id: '1',
  title: 'Task 1',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'p1',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

describe('buildGanttTasks', () => {
  it('maps a scheduled leaf task with an end date one day past dueDate', () => {
    const tasks: ProjectTask[] = [
      {
        ...baseTask,
        id: '1',
        title: 'Design',
        status: 'in_progress',
        startDate: '2026-03-01',
        dueDate: '2026-03-05',
      },
    ]

    expect(buildGanttTasks(tasks)).toEqual([
      {
        id: '1',
        text: 'Design',
        parent: 0,
        type: 'in_progress',
        unscheduled: false,
        start: new Date('2026-03-01T00:00:00'),
        end: new Date('2026-03-06T00:00:00'),
      },
    ])
  })

  it('marks a task with no dates as unscheduled and omits start/end', () => {
    const tasks: ProjectTask[] = [
      { ...baseTask, id: '1', title: 'No dates', status: 'todo' },
    ]

    expect(buildGanttTasks(tasks)).toEqual([
      {
        id: '1',
        text: 'No dates',
        parent: 0,
        type: 'todo',
        unscheduled: true,
      },
    ])
  })

  it('marks a task with only one of startDate/dueDate as unscheduled', () => {
    const tasks: ProjectTask[] = [
      { ...baseTask, id: '1', title: 'Only start', startDate: '2026-03-01' },
    ]

    expect(buildGanttTasks(tasks)).toEqual([
      {
        id: '1',
        text: 'Only start',
        parent: 0,
        type: 'todo',
        unscheduled: true,
      },
    ])
  })

  it('assigns "summary" type to a task that has children, ignoring its own status', () => {
    const tasks: ProjectTask[] = [
      { ...baseTask, id: 'parent', title: 'Parent', status: 'completed' },
      {
        ...baseTask,
        id: 'child',
        title: 'Child',
        parentId: 'parent',
        startDate: '2026-03-01',
        dueDate: '2026-03-02',
      },
    ]

    expect(buildGanttTasks(tasks)).toEqual([
      {
        id: 'parent',
        text: 'Parent',
        parent: 0,
        type: 'summary',
        unscheduled: true,
      },
      {
        id: 'child',
        text: 'Child',
        parent: 'parent',
        type: 'todo',
        unscheduled: false,
        start: new Date('2026-03-01T00:00:00'),
        end: new Date('2026-03-03T00:00:00'),
      },
    ])
  })
})

describe('toDateOnlyString', () => {
  it('zero-pads single digit month and day', () => {
    expect(toDateOnlyString(new Date('2026-01-02T00:00:00'))).toBe('2026-01-02')
  })

  it('does not pad double digit month and day', () => {
    expect(toDateOnlyString(new Date('2026-12-25T00:00:00'))).toBe('2026-12-25')
  })
})

function describeScales(
  scales: ReturnType<typeof getScaleConfig>,
  date: Date,
  next?: Date,
): Array<{ unit: string; step: number; label: string | undefined }> {
  return scales.map((s) => ({
    unit: s.unit,
    step: s.step,
    label: typeof s.format === 'function' ? s.format(date, next) : s.format,
  }))
}

describe('getScaleConfig', () => {
  it('formats the day scale as month header + M/D day cells', () => {
    const scales = getScaleConfig('day')
    const date = new Date('2026-03-07T00:00:00')

    expect(describeScales(scales, date)).toEqual([
      { unit: 'month', step: 1, label: 'March 2026' },
      { unit: 'day', step: 1, label: '3/7' },
    ])
  })

  it('formats the week scale as month header + "W<n> (M/D-M/D)" week cells', () => {
    const scales = getScaleConfig('week')
    const start = new Date('2026-03-02T00:00:00')
    const next = new Date('2026-03-09T00:00:00')

    expect(describeScales(scales, start, next)).toEqual([
      { unit: 'month', step: 1, label: 'March 2026' },
      { unit: 'week', step: 1, label: 'W10 (3/2-3/8)' },
    ])
  })

  it('formats the month scale as short month + year', () => {
    const scales = getScaleConfig('month')
    const date = new Date('2026-03-07T00:00:00')

    expect(describeScales(scales, date)).toEqual([
      { unit: 'month', step: 1, label: 'Mar 2026' },
    ])
  })
})
