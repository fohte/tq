import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import {
  DayViewPresentation,
  type DayViewPresentationProps,
  estimateMinutesForRange,
} from '#components/day-view/day-view'

describe('estimateMinutesForRange', () => {
  it('uses the selected range length when it is at least 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T10:00:00')

    expect(estimateMinutesForRange({ start, end })).toBe(60)
  })

  it('clamps a shorter selection (e.g. a plain click) up to 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T09:15:00')

    expect(estimateMinutesForRange({ start, end })).toBe(30)
  })
})

let capturedOnSelectRange:
  ((info: { start: Date; end: Date }) => void) | undefined
let capturedModalProps: {
  open: boolean
  defaultStartDate?: string
  defaultEstimateMinutes?: number
  onCreated?: (task: { id: string }) => void
} = { open: false }

vi.mock('#components/calendar/calendar-view', () => ({
  CalendarView: (props: {
    onSelectRange?: (info: { start: Date; end: Date }) => void
  }) => {
    capturedOnSelectRange = props.onSelectRange
    return null
  },
}))

vi.mock('#components/task/create-task-modal', () => ({
  CreateTaskModal: (props: typeof capturedModalProps) => {
    capturedModalProps = props
    return null
  },
}))

function renderDayView(
  overrides: Partial<DayViewPresentationProps> = {},
  onCreateTimeBlock = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const props: DayViewPresentationProps = {
    isLoading: false,
    calendarEvents: [],
    schedules: [],
    onCreateTimeBlock,
    queueSections: [],
    dayQueueTasks: [],
    queueCandidates: [],
    onReorderQueue: vi.fn(),
    onMoveTask: vi.fn(),
    onInsertCandidate: vi.fn(),
    onAddCandidate: vi.fn(),
    onRemoveFromQueue: vi.fn(),
    onAutoAssign: vi.fn(),
    isAutoAssigning: false,
    selectedDate: new Date('2026-07-20T00:00:00'),
    onDateChange: vi.fn(),
    viewMode: 'queue',
    onViewModeChange: vi.fn(),
    ...overrides,
  }
  render(
    <QueryClientProvider client={queryClient}>
      <DayViewPresentation {...props} />
    </QueryClientProvider>,
  )
  return { onCreateTimeBlock }
}

describe('DayViewPresentation', () => {
  it('prefills the modal from a calendar selection and creates a time block once the task is created', () => {
    const { onCreateTimeBlock } = renderDayView()
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T10:00:00')

    act(() => {
      capturedOnSelectRange?.({ start, end })
    })

    expect(capturedModalProps.open).toBe(true)
    expect(capturedModalProps.defaultStartDate).toBe('2026-07-20')
    expect(capturedModalProps.defaultEstimateMinutes).toBe(60)

    act(() => {
      capturedModalProps.onCreated?.({ id: 'task-1' })
    })

    expect(onCreateTimeBlock).toHaveBeenCalledExactlyOnceWith({
      taskId: 'task-1',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    })
  })

  it('does not create a time block when the task is created from the "New task" button', async () => {
    const user = userEvent.setup()
    const { onCreateTimeBlock } = renderDayView()

    await user.click(screen.getByLabelText('New task'))
    act(() => {
      capturedModalProps.onCreated?.({ id: 'task-2' })
    })

    expect(onCreateTimeBlock).not.toHaveBeenCalled()
  })
})
