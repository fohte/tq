import {
  getDaysRemaining,
  summarizeTaskStatus,
} from '@web/components/project/project-detail'
import type { ProjectTask } from '@web/hooks/use-projects'
import { describe, expect, it } from 'vitest'

const baseTask: ProjectTask = {
  id: '1',
  title: 'Task',
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
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('summarizeTaskStatus', () => {
  it('counts tasks by status', () => {
    const tasks: ProjectTask[] = [
      { ...baseTask, id: '1', status: 'todo' },
      { ...baseTask, id: '2', status: 'todo' },
      { ...baseTask, id: '3', status: 'in_progress' },
      { ...baseTask, id: '4', status: 'completed' },
    ]
    expect(summarizeTaskStatus(tasks)).toEqual({
      total: 4,
      todo: 2,
      inProgress: 1,
      completed: 1,
    })
  })

  it('returns all zeroes for an empty task list', () => {
    expect(summarizeTaskStatus([])).toEqual({
      total: 0,
      todo: 0,
      inProgress: 0,
      completed: 0,
    })
  })
})

describe('getDaysRemaining', () => {
  it('returns positive days for a future target date', () => {
    expect(
      getDaysRemaining('2024-12-08', new Date('2024-11-15T09:00:00')),
    ).toBe(23)
  })

  it('returns 0 when the target date is today', () => {
    expect(
      getDaysRemaining('2024-11-15', new Date('2024-11-15T23:00:00')),
    ).toBe(0)
  })

  it('returns a negative number for a past target date', () => {
    expect(
      getDaysRemaining('2024-11-01', new Date('2024-11-15T00:00:00')),
    ).toBe(-14)
  })
})
