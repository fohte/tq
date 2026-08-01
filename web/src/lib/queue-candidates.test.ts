import { describe, expect, it } from 'vitest'

import {
  formatCandidateReason,
  getCandidateReason,
  getQueueCandidates,
} from '#lib/queue-candidates'

const now = new Date('2026-03-20T12:00:00')

function makeCandidateTask(overrides: {
  id?: string
  status?: string
  dueDate?: string | null
  startDate?: string | null
}) {
  return {
    id: '1',
    status: 'todo',
    dueDate: null,
    startDate: null,
    ...overrides,
  }
}

describe('getCandidateReason', () => {
  it('returns null for a completed task', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ status: 'completed', dueDate: '2026-03-01' }),
        now,
      ),
    ).toBeNull()
  })

  it('returns overdue with the number of days past due', () => {
    expect(
      getCandidateReason(makeCandidateTask({ dueDate: '2026-03-17' }), now),
    ).toEqual({ kind: 'overdue', days: 3 })
  })

  it('returns due-today when the due date is today', () => {
    expect(
      getCandidateReason(makeCandidateTask({ dueDate: '2026-03-20' }), now),
    ).toEqual({ kind: 'due-today' })
  })

  it('returns starts with days=0 when the start date is today', () => {
    expect(
      getCandidateReason(makeCandidateTask({ startDate: '2026-03-20' }), now),
    ).toEqual({ kind: 'starts', days: 0 })
  })

  it('returns starts with days since start when the start date is in the past', () => {
    expect(
      getCandidateReason(makeCandidateTask({ startDate: '2026-03-17' }), now),
    ).toEqual({ kind: 'starts', days: 3 })
  })

  it('prefers overdue over a past start date', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-17', startDate: '2026-03-10' }),
        now,
      ),
    ).toEqual({ kind: 'overdue', days: 3 })
  })

  it('prefers due-today over a past start date', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-20', startDate: '2026-03-10' }),
        now,
      ),
    ).toEqual({ kind: 'due-today' })
  })

  it('returns null when the due date and start date are both in the future', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-25', startDate: '2026-03-25' }),
        now,
      ),
    ).toBeNull()
  })

  it('returns null when there is no due date or start date', () => {
    expect(getCandidateReason(makeCandidateTask({}), now)).toBeNull()
  })
})

describe('getQueueCandidates', () => {
  it('excludes tasks already in the queue', () => {
    const candidateTask = makeCandidateTask({
      id: '1',
      dueDate: '2026-03-17',
    })
    const queuedTask = makeCandidateTask({ id: '2', dueDate: '2026-03-01' })
    const queueTaskIds = new Set([queuedTask.id])

    expect(
      getQueueCandidates([candidateTask, queuedTask], queueTaskIds, now),
    ).toEqual([{ task: candidateTask, reason: { kind: 'overdue', days: 3 } }])
  })

  it('sorts candidates by reason priority, then by days within a priority', () => {
    const overdueTask = makeCandidateTask({ id: '1', dueDate: '2026-03-17' })
    const moreOverdueTask = makeCandidateTask({
      id: '2',
      dueDate: '2026-03-10',
    })
    const dueTodayTask = makeCandidateTask({ id: '3', dueDate: '2026-03-20' })
    const startsTodayTask = makeCandidateTask({
      id: '4',
      startDate: '2026-03-20',
    })
    const tasks = [dueTodayTask, overdueTask, startsTodayTask, moreOverdueTask]

    expect(getQueueCandidates(tasks, new Set(), now)).toEqual([
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
