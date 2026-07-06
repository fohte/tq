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
  it('formats a Date as YYYY-MM-DD in local time', () => {
    expect(toDateOnlyString(new Date('2026-03-05T00:00:00'))).toBe('2026-03-05')
  })

  it('zero-pads single digit month and day', () => {
    expect(toDateOnlyString(new Date('2026-01-02T00:00:00'))).toBe('2026-01-02')
  })
})

describe('getScaleConfig', () => {
  it('formats the day scale as month header + M/D day cells', () => {
    const scales = getScaleConfig('day')
    expect(scales).toHaveLength(2)
    const [monthScale, dayScale] = scales

    expect(
      typeof monthScale?.format === 'function'
        ? monthScale.format(new Date('2026-03-07T00:00:00'))
        : monthScale?.format,
    ).toBe('March 2026')
    expect(
      typeof dayScale?.format === 'function'
        ? dayScale.format(new Date('2026-03-07T00:00:00'))
        : dayScale?.format,
    ).toBe('3/7')
  })

  it('formats the week scale as "W<n> (M/D-M/D)"', () => {
    const scales = getScaleConfig('week')
    expect(scales).toHaveLength(2)
    const weekScale = scales[1]

    const format = weekScale?.format
    expect(typeof format).toBe('function')
    if (typeof format !== 'function') throw new Error('unreachable')

    expect(
      format(new Date('2026-03-02T00:00:00'), new Date('2026-03-09T00:00:00')),
    ).toBe('W10 (3/2-3/8)')
  })

  it('formats the month scale as short month + year', () => {
    const scales = getScaleConfig('month')
    expect(scales).toHaveLength(1)
    const format = scales[0]?.format

    expect(
      typeof format === 'function'
        ? format(new Date('2026-03-07T00:00:00'))
        : format,
    ).toBe('Mar 2026')
  })
})
