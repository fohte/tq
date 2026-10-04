import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import {
  buildNowPanelModel,
  buildNowPanelTaskRowStates,
} from '#components/day-view/now-panel-model'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTaskRowTimeBlockState } from '#components/task/task-row-time-block-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { useNowPanelClock } from '#hooks/use-now-panel-clock'

afterEach(() => {
  vi.useRealTimers()
})

describe('useNowPanelClock', () => {
  it('updates the panel model and task row state when a work block ends', async () => {
    vi.useFakeTimers()
    const startTime = new Date(2031, 3, 9, 9, 0).toISOString()
    const endTime = new Date(2031, 3, 9, 9, 1).toISOString()
    const task = makeTask({ id: 'clocked-task' })
    const timeBlock = makeTimeBlock({
      id: 'clocked-block',
      taskId: task.id,
      startTime,
      endTime,
    })
    const calendarEvent = makeTimeBlockEvent({
      id: timeBlock.id,
      title: task.title,
      start: timeBlock.startTime,
      end: timeBlock.endTime,
      type: 'manual',
      taskId: task.id,
    })
    const tasks = new Map([[task.id, task]])

    vi.setSystemTime(new Date(2031, 3, 9, 9, 0, 30))
    const { result } = renderHook(() => {
      const now = useNowPanelClock(true)
      const model = buildNowPanelModel({
        now,
        timeBlocks: [timeBlock],
        calendarEvents: [calendarEvent],
        tasks,
      })
      const taskRowStates = buildNowPanelTaskRowStates({
        now,
        timeBlocks: [timeBlock],
        model,
      })
      return { now, model, taskRowStates }
    })

    expect(result.current).toEqual({
      now: new Date(2031, 3, 9, 9, 0, 30),
      model: {
        activities: [
          {
            kind: 'task',
            key: timeBlock.id,
            task,
            blockEnd: timeBlock.endTime,
            statusLabel: 'now (1 min left)',
            isOverrun: false,
          },
        ],
        emptyState: null,
        nextEvent: null,
      },
      taskRowStates: new Map([
        [
          task.id,
          makeTaskRowTimeBlockState({
            timeRanges: ['09:00–09:01'],
            isCurrentTimeBlock: true,
          }),
        ],
      ]),
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })

    expect(result.current).toEqual({
      now: new Date(2031, 3, 9, 9, 1, 30),
      model: {
        activities: [
          {
            kind: 'task',
            key: timeBlock.id,
            task,
            blockEnd: timeBlock.endTime,
            statusLabel: 'block ended 1 min ago',
            isOverrun: true,
          },
        ],
        emptyState: null,
        nextEvent: null,
      },
      taskRowStates: new Map([
        [
          task.id,
          makeTaskRowTimeBlockState({
            timeRanges: ['09:00–09:01'],
            blockEndedAt: '09:01',
          }),
        ],
      ]),
    })
  })

  it('refreshes the clock immediately when compact mode is enabled', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2031, 3, 9, 8, 0))
    const { result, rerender } = renderHook(
      ({ enabled }) => useNowPanelClock(enabled),
      { initialProps: { enabled: false } },
    )

    vi.setSystemTime(new Date(2031, 3, 9, 14, 0))
    rerender({ enabled: true })

    expect(result.current).toEqual(new Date(2031, 3, 9, 14, 0))
  })
})
