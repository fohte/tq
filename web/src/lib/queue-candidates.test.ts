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
  commitment?: string
}) {
  return {
    id: '1',
    status: 'todo',
    dueDate: null,
    startDate: null,
    commitment: 'someday',
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

  it('returns active for a dateless task with commitment active', () => {
    expect(
      getCandidateReason(makeCandidateTask({ commitment: 'active' }), now),
    ).toEqual({ kind: 'active' })
  })

  it('prefers overdue over commitment active', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-17', commitment: 'active' }),
        now,
      ),
    ).toEqual({ kind: 'overdue', days: 3 })
  })

  it('prefers due-today over commitment active', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-20', commitment: 'active' }),
        now,
      ),
    ).toEqual({ kind: 'due-today' })
  })

  it('prefers a past start date over commitment active', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ startDate: '2026-03-17', commitment: 'active' }),
        now,
      ),
    ).toEqual({ kind: 'starts', days: 3 })
  })

  it('returns due-later when an active task has a future due date', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({ dueDate: '2026-03-25', commitment: 'active' }),
        now,
      ),
    ).toEqual({ kind: 'due-later', days: 5 })
  })

  it('prefers due-later over a past start date', () => {
    expect(
      getCandidateReason(
        makeCandidateTask({
          dueDate: '2026-03-25',
          startDate: '2026-03-10',
        }),
        now,
      ),
    ).toEqual({ kind: 'due-later', days: 5 })
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

  it('sorts candidates by reason priority', () => {
    const overdueTask = makeCandidateTask({ id: '1', dueDate: '2026-03-17' })
    const dueTodayTask = makeCandidateTask({ id: '2', dueDate: '2026-03-20' })
    const dueLaterTask = makeCandidateTask({
      id: '3',
      dueDate: '2026-03-22',
      commitment: 'active',
    })
    const startsTask = makeCandidateTask({ id: '4', startDate: '2026-03-20' })
    const activeTask = makeCandidateTask({ id: '5', commitment: 'active' })

    expect(
      getQueueCandidates(
        [activeTask, startsTask, dueLaterTask, overdueTask, dueTodayTask],
        new Set(),
        now,
      ),
    ).toEqual([
      { task: overdueTask, reason: { kind: 'overdue', days: 3 } },
      { task: dueTodayTask, reason: { kind: 'due-today' } },
      { task: dueLaterTask, reason: { kind: 'due-later', days: 2 } },
      { task: startsTask, reason: { kind: 'starts', days: 0 } },
      { task: activeTask, reason: { kind: 'active' } },
    ])
  })

  it('orders due-later candidates by soonest due date first', () => {
    const farTask = makeCandidateTask({
      id: '1',
      dueDate: '2026-04-20',
      commitment: 'active',
    })
    const nearTask = makeCandidateTask({
      id: '2',
      dueDate: '2026-03-22',
      commitment: 'active',
    })

    expect(getQueueCandidates([farTask, nearTask], new Set(), now)).toEqual([
      { task: nearTask, reason: { kind: 'due-later', days: 2 } },
      { task: farTask, reason: { kind: 'due-later', days: 31 } },
    ])
  })

  it('orders overdue candidates by longest overdue first', () => {
    const recentTask = makeCandidateTask({ id: '1', dueDate: '2026-03-17' })
    const olderTask = makeCandidateTask({ id: '2', dueDate: '2026-03-10' })

    expect(getQueueCandidates([recentTask, olderTask], new Set(), now)).toEqual(
      [
        { task: olderTask, reason: { kind: 'overdue', days: 10 } },
        { task: recentTask, reason: { kind: 'overdue', days: 3 } },
      ],
    )
  })

  it('orders starts candidates by oldest start date first', () => {
    const recentTask = makeCandidateTask({ id: '1', startDate: '2026-03-17' })
    const olderTask = makeCandidateTask({ id: '2', startDate: '2026-02-18' })

    expect(getQueueCandidates([recentTask, olderTask], new Set(), now)).toEqual(
      [
        { task: olderTask, reason: { kind: 'starts', days: 30 } },
        { task: recentTask, reason: { kind: 'starts', days: 3 } },
      ],
    )
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

  it('formats due-later', () => {
    expect(formatCandidateReason({ kind: 'due-later', days: 2 })).toBe(
      'due in 2d',
    )
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

  it('formats active', () => {
    expect(formatCandidateReason({ kind: 'active' })).toBe('active')
  })
})
