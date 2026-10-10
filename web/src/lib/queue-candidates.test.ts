import { describe, expect, it } from 'vitest'

import {
  formatCandidateReason,
  getQueueCandidates,
} from '#lib/queue-candidates'

describe('getQueueCandidates', () => {
  it('keeps the API order and pairs each task with its reason', () => {
    const followUpTask = {
      id: 'task-follow-up',
      candidateReason: { kind: 'follow-up', days: 2 } as const,
    }
    const overdueTask = {
      id: 'task-overdue',
      candidateReason: { kind: 'overdue', days: 5 } as const,
    }
    const completedTask = { id: 'task-without-reason', candidateReason: null }

    expect(
      getQueueCandidates([followUpTask, overdueTask, completedTask]),
    ).toEqual([
      { task: followUpTask, reason: { kind: 'follow-up', days: 2 } },
      { task: overdueTask, reason: { kind: 'overdue', days: 5 } },
    ])
  })
})

describe('formatCandidateReason', () => {
  it('formats overdue', () => {
    expect(formatCandidateReason({ kind: 'overdue', days: 3 })).toBe(
      '3d overdue',
    )
  })

  it('formats follow-up today', () => {
    expect(formatCandidateReason({ kind: 'follow-up', days: 0 })).toBe(
      'follow up today',
    )
  })

  it('formats overdue follow-up', () => {
    expect(formatCandidateReason({ kind: 'follow-up', days: 3 })).toBe(
      'follow up 3d ago',
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
