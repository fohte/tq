import {
  filterTasks,
  sortTasks,
} from '@web/components/project/project-task-list'
import type { ProjectTask } from '@web/hooks/use-projects'
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

const tasks: ProjectTask[] = [
  { ...baseTask, id: '1', title: 'Todo task', status: 'todo' },
  {
    ...baseTask,
    id: '2',
    title: 'In progress task',
    status: 'in_progress',
  },
  {
    ...baseTask,
    id: '3',
    title: 'Completed task',
    status: 'completed',
  },
  {
    ...baseTask,
    id: '4',
    title: 'Another todo',
    status: 'todo',
    dueDate: '2026-04-01',
  },
]

describe('filterTasks', () => {
  it('returns all tasks when filter is "all"', () => {
    expect(filterTasks(tasks, 'all')).toHaveLength(4)
  })

  it('filters by todo status', () => {
    const result = filterTasks(tasks, 'todo')
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.status === 'todo')).toBe(true)
  })

  it('filters by in_progress status', () => {
    const result = filterTasks(tasks, 'in_progress')
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('In progress task')
  })

  it('filters by completed status', () => {
    const result = filterTasks(tasks, 'completed')
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('Completed task')
  })
})

describe('sortTasks', () => {
  it('returns original order for manual sort', () => {
    const result = sortTasks(tasks, 'manual')
    expect(result.map((t) => t.id)).toEqual(['1', '2', '3', '4'])
  })

  it('sorts by due date with nulls last', () => {
    const result = sortTasks(tasks, 'due')
    expect(result[0]?.dueDate).toBe('2026-04-01')
    expect(result[1]?.dueDate).toBeNull()
  })

  it('sorts by created date ascending', () => {
    const tasksWithDates: ProjectTask[] = [
      {
        ...baseTask,
        id: 'a',
        createdAt: '2026-03-22T00:00:00.000Z',
      },
      {
        ...baseTask,
        id: 'b',
        createdAt: '2026-03-20T00:00:00.000Z',
      },
      {
        ...baseTask,
        id: 'c',
        createdAt: '2026-03-21T00:00:00.000Z',
      },
    ]
    const result = sortTasks(tasksWithDates, 'created')
    expect(result.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by updated date descending', () => {
    const tasksWithDates: ProjectTask[] = [
      {
        ...baseTask,
        id: 'a',
        updatedAt: '2026-03-20T00:00:00.000Z',
      },
      {
        ...baseTask,
        id: 'b',
        updatedAt: '2026-03-22T00:00:00.000Z',
      },
      {
        ...baseTask,
        id: 'c',
        updatedAt: '2026-03-21T00:00:00.000Z',
      },
    ]
    const result = sortTasks(tasksWithDates, 'updated')
    expect(result.map((t) => t.id)).toEqual(['b', 'c', 'a'])
  })
})
