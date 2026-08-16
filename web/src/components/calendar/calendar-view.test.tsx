import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarView } from '#components/calendar/calendar-view'
import { atIndex } from '#lib/test-utils'

// Mock FullCalendar to avoid complex DOM rendering
let mockViewType = 'timeGridDay'
const mockChangeView = vi.fn((viewType: string) => {
  mockViewType = viewType
})
const mockGotoDate = vi.fn()
const mockPrev = vi.fn()
const mockNext = vi.fn()
const mockToday = vi.fn()
const mockGetDate = vi.fn(() => new Date(2025, 2, 7))

let latestDatesSet:
  ((info: { view: { currentStart: Date } }) => void) | undefined

vi.mock('@fullcalendar/react', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function MockFullCalendar(
      props: Record<string, unknown>,
      ref: React.Ref<unknown>,
    ) {
      latestDatesSet =
        typeof props['datesSet'] === 'function'
          ? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar datesSet handler
            (props['datesSet'] as (info: {
              view: { currentStart: Date }
            }) => void)
          : undefined
      React.useImperativeHandle(ref, () => ({
        getApi: () => ({
          changeView: mockChangeView,
          gotoDate: mockGotoDate,
          prev: mockPrev,
          next: mockNext,
          today: mockToday,
          getDate: mockGetDate,
          view: {
            get type() {
              return mockViewType
            },
          },
        }),
      }))
      const initialView =
        typeof props['initialView'] === 'string' ? props['initialView'] : ''
      // Real FullCalendar's `view.type` reflects `initialView` from the
      // first render onward; mirror that here (once, via useState's lazy
      // initializer) so the mock doesn't itself trigger CalendarGrid's
      // mount-time view sync effect.
      React.useState(() => {
        if (initialView !== '') mockViewType = initialView
      })
      return (
        <div
          data-testid="fullcalendar"
          data-view={initialView}
          onClick={() => {
            const dateClick = props['dateClick']
            if (typeof dateClick === 'function') {
              // eslint-disable-next-line @typescript-eslint/no-unsafe-call -- calling mock dateClick prop
              dateClick({ date: new Date(2025, 2, 15) })
            }
          }}
        />
      )
    }),
  }
})

vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))

function fireDatesSet(currentStart: Date) {
  latestDatesSet?.({ view: { currentStart } })
}

const initialSelectedDate = new Date(2025, 2, 7)

function renderCalendarView(
  props: Partial<ComponentProps<typeof CalendarView>> = {},
) {
  return render(
    <CalendarView
      selectedDate={initialSelectedDate}
      onDateChange={vi.fn()}
      {...props}
    />,
  )
}

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockViewType = 'timeGridDay'
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
  })

  it('renders with day view by default', () => {
    renderCalendarView()
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'timeGridDay',
    )
  })

  it('renders with week view when initialView is week', () => {
    renderCalendarView({ initialView: 'week' })
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'timeGridWeek',
    )
  })

  it('renders with month view when initialView is month', () => {
    renderCalendarView({ initialView: 'month' })
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'dayGridMonth',
    )
  })

  it('substitutes a 3-day view for week view on narrow viewports', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })

    renderCalendarView({ initialView: 'week' })

    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'timeGridThreeDay',
    )
  })

  it('switches to week view when week button is clicked', async () => {
    const user = userEvent.setup()
    renderCalendarView()

    const weekButtons = screen.getAllByText('week')
    await user.click(atIndex(weekButtons, weekButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledExactlyOnceWith('timeGridWeek')
  })

  it('switches to month view when month button is clicked', async () => {
    const user = userEvent.setup()
    renderCalendarView()

    const monthButtons = screen.getAllByText('month')
    await user.click(atIndex(monthButtons, monthButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledExactlyOnceWith('dayGridMonth')
  })

  it('switches back to day view when day button is clicked from week view', async () => {
    const user = userEvent.setup()
    renderCalendarView({ initialView: 'week' })

    const dayButtons = screen.getAllByText('day')
    await user.click(atIndex(dayButtons, dayButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledExactlyOnceWith('timeGridDay')
  })

  it('navigates to day view on date click in month view', async () => {
    const user = userEvent.setup()
    renderCalendarView({ initialView: 'month' })

    // Click the mock calendar to trigger dateClick
    await user.click(screen.getByTestId('fullcalendar'))

    expect(mockGotoDate).toHaveBeenCalledWith(new Date(2025, 2, 15))
    expect(mockChangeView).toHaveBeenCalledExactlyOnceWith('timeGridDay')
  })

  it('highlights active view button', () => {
    renderCalendarView({ initialView: 'week' })

    const weekButtons = screen.getAllByText('week')
    const activeWeekButton = atIndex(weekButtons, weekButtons.length - 1)
    expect(activeWeekButton).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onDateChange with the date FullCalendar reports after Previous is clicked', async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()
    renderCalendarView({ onDateChange })

    const reportedDate = new Date(2025, 2, 6)
    mockGetDate.mockReturnValueOnce(reportedDate)
    await user.click(screen.getByLabelText('Previous'))

    expect(mockPrev).toHaveBeenCalled()
    expect(onDateChange).toHaveBeenCalledWith(reportedDate)
  })

  it('calls onDateChange with the date FullCalendar reports after Next is clicked', async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()
    renderCalendarView({ onDateChange })

    const reportedDate = new Date(2025, 2, 8)
    mockGetDate.mockReturnValueOnce(reportedDate)
    await user.click(screen.getByLabelText('Next'))

    expect(mockNext).toHaveBeenCalled()
    expect(onDateChange).toHaveBeenCalledWith(reportedDate)
  })

  it('calls onDateChange with the date FullCalendar reports after Today is clicked', async () => {
    const user = userEvent.setup()
    const onDateChange = vi.fn()
    renderCalendarView({ onDateChange })

    const reportedDate = new Date(2025, 5, 1)
    mockGetDate.mockReturnValueOnce(reportedDate)
    await user.click(screen.getByText('today'))

    expect(mockToday).toHaveBeenCalled()
    expect(onDateChange).toHaveBeenCalledWith(reportedDate)
  })

  it('syncs FullCalendar to a new selectedDate from an external source', () => {
    const onDateChange = vi.fn()
    const { rerender } = renderCalendarView({ onDateChange })

    const externalDate = new Date(2025, 2, 20)
    rerender(
      <CalendarView selectedDate={externalDate} onDateChange={onDateChange} />,
    )

    expect(mockGotoDate).toHaveBeenCalledWith(externalDate)
  })

  it('ignores the datesSet triggered by its own gotoDate sync, so onDateChange is not corrupted with the wrong date', () => {
    const onDateChange = vi.fn()
    const { rerender } = renderCalendarView({ onDateChange })
    onDateChange.mockClear()

    const wrongCurrentStart = new Date(2025, 2, 1)
    mockGotoDate.mockImplementationOnce(() => {
      fireDatesSet(wrongCurrentStart)
    })

    const externalDate = new Date(2025, 2, 20)
    rerender(
      <CalendarView selectedDate={externalDate} onDateChange={onDateChange} />,
    )

    expect(mockGotoDate).toHaveBeenCalledWith(externalDate)
    expect(onDateChange).not.toHaveBeenCalledWith(wrongCurrentStart)
  })

  it('does not call gotoDate when selectedDate changes to the same day FullCalendar already shows', () => {
    const onDateChange = vi.fn()
    const { rerender } = renderCalendarView({ onDateChange })

    const sameDay = new Date(2025, 2, 7, 15, 30)
    rerender(
      <CalendarView selectedDate={sameDay} onDateChange={onDateChange} />,
    )

    expect(mockGotoDate).not.toHaveBeenCalled()
  })
})
