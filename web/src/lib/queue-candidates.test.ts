import { describe, expect, it } from 'vitest'

import {
  formatCandidateReason,
  getCandidateReason,
  getQueueCandidates,
} from '#lib/queue-candidates'

const now = new Date('2026-03-20T12:00:00')

describe('getCandidateReason', () => {
  it('returns null for a completed task', () => {
    expect(
      getCandidateReason(
        {
          id: '1',
          status: 'completed',
          dueDate: '2026-03-01',
          startDate: null,
        },
        now,
      ),
    ).toBeNull()
  })

  it('returns overdue with the number of days past due', () => {
    expect(
      getCandidateReason(
        { id: '1', status: 'todo', dueDate: '2026-03-17', startDate: null },
        now,
      ),
    ).toEqual({ kind: 'overdue', days: 3 })
  })

  it('returns due-today when the due date is today', () => {
    expect(
      getCandidateReason(
        { id: '1', status: 'todo', dueDate: '2026-03-20', startDate: null },
        now,
      ),
    ).toEqual({ kind: 'due-today' })
  })

  it('returns starts with days=0 when the start date is today', () => {
    expect(
      getCandidateReason(
        { id: '1', status: 'todo', dueDate: null, startDate: '2026-03-20' },
        now,
      ),
    ).toEqual({ kind: 'starts', days: 0 })
  })

  it('returns starts with days since start when the start date is in the past', () => {
    expect(
      getCandidateReason(
        { id: '1', status: 'todo', dueDate: null, startDate: '2026-03-17' },
        now,
      ),
    ).toEqual({ kind: 'starts', days: 3 })
  })

  it('prefers overdue over a past start date', () => {
    expect(
      getCandidateReason(
        {
          id: '1',
          status: 'todo',
          dueDate: '2026-03-17',
          startDate: '2026-03-10',
        },
        now,
      ),
    ).toEqual({ kind: 'overdue', days: 3 })
  })

  it('prefers due-today over a past start date', () => {
    expect(
      getCandidateReason(
        {
          id: '1',
          status: 'todo',
          dueDate: '2026-03-20',
          startDate: '2026-03-10',
        },
        now,
      ),
    ).toEqual({ kind: 'due-today' })
  })

  it('returns null when the due date and start date are both in the future', () => {
    expect(
      getCandidateReason(
        {
          id: '1',
          status: 'todo',
          dueDate: '2026-03-25',
          startDate: '2026-03-25',
        },
        now,
      ),
    ).toBeNull()
  })

  it('returns null when there is no due date or start date', () => {
    expect(
      getCandidateReason(
        { id: '1', status: 'todo', dueDate: null, startDate: null },
        now,
      ),
    ).toBeNull()
  })
})

describe('getQueueCandidates', () => {
  const overdueTask = {
    id: '1',
    status: 'todo',
    dueDate: '2026-03-17',
    startDate: null,
  }
  const moreOverdueTask = {
    id: '2',
    status: 'todo',
    dueDate: '2026-03-10',
    startDate: null,
  }
  const dueTodayTask = {
    id: '3',
    status: 'todo',
    dueDate: '2026-03-20',
    startDate: null,
  }
  const startsTodayTask = {
    id: '4',
    status: 'todo',
    dueDate: null,
    startDate: '2026-03-20',
  }
  const queuedOverdueTask = {
    id: '5',
    status: 'todo',
    dueDate: '2026-03-01',
    startDate: null,
  }
  const notCandidateTask = {
    id: '6',
    status: 'todo',
    dueDate: '2026-03-25',
    startDate: null,
  }
  const completedOverdueTask = {
    id: '7',
    status: 'completed',
    dueDate: '2026-03-01',
    startDate: null,
  }

  it('filters out non-candidates and queued tasks, sorted by reason priority and days', () => {
    const tasks = [
      dueTodayTask,
      overdueTask,
      notCandidateTask,
      startsTodayTask,
      moreOverdueTask,
      queuedOverdueTask,
      completedOverdueTask,
    ]
    const queueTaskIds = new Set([queuedOverdueTask.id])

    expect(getQueueCandidates(tasks, queueTaskIds, now)).toEqual([
      { task: moreOverdueTask, reason: { kind: 'overdue', days: 10 } },
      { task: overdueTask, reason: { kind: 'overdue', days: 3 } },
      { task: dueTodayTask, reason: { kind: 'due-today' } },
      { task: startsTodayTask, reason: { kind: 'starts', days: 0 } },
    ])
  })
})

describe('formatCandidateReason', () => {
  it('formats overdue', () => {
    expect(formatCandidateReason({ kind: 'overdue', days: 3 })).toBe(
      '3d overdue',
    )
  })

  it('formats due-today', () => {
    expect(formatCandidateReason({ kind: 'due-today' })).toBe('due today')
  })

  it('formats starts today', () => {
    expect(formatCandidateReason({ kind: 'starts', days: 0 })).toBe(
      'starts today',
    )
  })

  it('formats starts in the past', () => {
    expect(formatCandidateReason({ kind: 'starts', days: 3 })).toBe(
      'started 3d ago',
    )
  })
})
