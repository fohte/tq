import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { useDayViewTaskData } from '#hooks/use-day-view-task-data'
import type { TaskListFilter } from '#hooks/use-task-queries'
import type { Task } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'

type TaskListResult = {
  data: Task[] | undefined
  isLoading: boolean
  error: unknown
}
type TaskListMock = (
  filter?: TaskListFilter<'row'>,
  options?: { enabled?: boolean; placeholderData?: unknown },
) => TaskListResult
type TaskMapMock = (tasks: Task[]) => Map<string, Task>

const mocks = vi.hoisted(() => ({
  useTaskList: vi.fn<TaskListMock>(),
  useTaskMap: vi.fn<TaskMapMock>(),
}))

vi.mock('#hooks/use-tasks', () => ({
  useTaskList: (...args: Parameters<TaskListMock>) =>
    mocks.useTaskList(...args),
  useTaskMap: (...args: Parameters<TaskMapMock>) => mocks.useTaskMap(...args),
}))

beforeEach(() => {
  mocks.useTaskList.mockReset()
  mocks.useTaskMap.mockImplementation(
    (tasks) => new Map(tasks.map((task) => [task.id, task])),
  )
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDayViewTaskData', () => {
  it('keeps a queued task visible while the referenced-task query loads', () => {
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const queuedTask = makeTask({
      id: 'queued-task',
      title: 'Review a sample note',
      dueDate: todayStr,
    })
    mocks.useTaskList.mockImplementation((filter) => ({
      data: filter?.candidatesOn != null ? [queuedTask] : [],
      isLoading: filter?.ids != null,
      error: null,
    }))

    const { result } = renderHook(() =>
      useDayViewTaskData({
        context: 'work',
        selectedDate: today,
        visibleRange: { startDate: todayStr, endDate: todayStr },
        queueItems: [makeQueueItem({ taskId: queuedTask.id })],
        visibleDayQueueItems: [],
        visibleTimeBlocks: [],
        nowPanelTimeBlocks: undefined,
        isCompactLayout: false,
      }),
    )

    expect(result.current.taskMap.get(queuedTask.id)?.title).toBe(
      queuedTask.title,
    )
  })

  it('logs candidate, task date, and overdue query errors in the default layout', async () => {
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const candidateError = new Error('candidate query failed')
    const taskDateError = new Error('task date query failed')
    const dueTaskError = new Error('overdue query failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useTaskList.mockImplementation((filter) => ({
      data: [],
      isLoading: false,
      error:
        filter?.candidatesOn != null
          ? candidateError
          : filter?.dateFrom != null
            ? taskDateError
            : filter?.dueTo != null
              ? dueTaskError
              : null,
    }))

    renderHook(() =>
      useDayViewTaskData({
        context: 'work',
        selectedDate: today,
        visibleRange: { startDate: todayStr, endDate: todayStr },
        queueItems: [],
        visibleDayQueueItems: [],
        visibleTimeBlocks: [],
        nowPanelTimeBlocks: undefined,
        isCompactLayout: false,
      }),
    )

    await waitFor(() => {
      expect(consoleError.mock.calls).toEqual([
        ['Failed to fetch day-view queue candidates', candidateError],
        ['Failed to fetch day-view task dates', taskDateError],
        ['Failed to fetch day-view overdue tasks', dueTaskError],
      ])
    })
  })
})
