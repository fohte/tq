import { act, renderHook } from '@testing-library/react'
import { useFocusNotes } from '@web/hooks/use-focus-notes'
import { beforeEach, describe, expect, it } from 'vitest'

function seedNotes(taskId: string, value: string) {
  localStorage.setItem(`tq:focus-notes:${taskId}`, value)
}

beforeEach(() => {
  localStorage.clear()
})

describe('useFocusNotes', () => {
  it('returns an empty string when no notes are stored for the task', () => {
    const { result } = renderHook(() => useFocusNotes('task-1'))

    expect(result.current[0]).toBe('')
  })

  it('returns previously stored notes for the task', () => {
    seedNotes('task-1', 'existing notes')

    const { result } = renderHook(() => useFocusNotes('task-1'))

    expect(result.current[0]).toBe('existing notes')
  })

  it('persists updated notes so a new hook instance for the same task sees them', () => {
    const { result } = renderHook(() => useFocusNotes('task-1'))

    act(() => {
      result.current[1]('new notes')
    })

    const { result: reloaded } = renderHook(() => useFocusNotes('task-1'))

    expect(reloaded.current[0]).toBe('new notes')
  })

  it('loads the new task notes when taskId changes', () => {
    seedNotes('task-2', 'task 2 notes')
    const { result, rerender } = renderHook(
      ({ taskId }) => useFocusNotes(taskId),
      { initialProps: { taskId: 'task-1' } },
    )

    rerender({ taskId: 'task-2' })

    expect(result.current[0]).toBe('task 2 notes')
  })
})
