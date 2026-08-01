import { describe, expect, it } from 'vitest'

import { formatDueDate, isTaskOverdue } from '#lib/task-due-date'

describe('isTaskOverdue', () => {
  const now = new Date('2026-03-20T12:00:00')

  it('returns false when there is no due date', () => {
    expect(isTaskOverdue({ status: 'todo', dueDate: null }, now)).toBe(false)
  })

  it('returns false when the due date is today', () => {
    expect(isTaskOverdue({ status: 'todo', dueDate: '2026-03-20' }, now)).toBe(
      false,
    )
  })

  it('returns false when the due date is in the future', () => {
    expect(isTaskOverdue({ status: 'todo', dueDate: '2026-03-21' }, now)).toBe(
      false,
    )
  })

  it('returns true when the due date is in the past and the task is not completed', () => {
    expect(isTaskOverdue({ status: 'todo', dueDate: '2026-03-19' }, now)).toBe(
      true,
    )
  })

  // status is typed as string, not a status union, so this pins that
  // "not completed" — not just status === 'todo' — is what makes a task
  // overdue-eligible.
  it('returns true for an in-progress task past its due date', () => {
    expect(
      isTaskOverdue({ status: 'in_progress', dueDate: '2026-03-19' }, now),
    ).toBe(true)
  })

  it('returns false for a completed task past its due date', () => {
    expect(
      isTaskOverdue({ status: 'completed', dueDate: '2026-03-19' }, now),
    ).toBe(false)
  })
})

describe('formatDueDate', () => {
  const now = new Date('2026-03-20T12:00:00')

  it('omits the year when the due date is in the current year', () => {
    expect(formatDueDate('2026-03-25', now)).toBe('Mar 25')
  })

  it('includes the year when the due date is in a different year', () => {
    expect(formatDueDate('2027-01-05', now)).toBe('Jan 5, 2027')
  })
})
