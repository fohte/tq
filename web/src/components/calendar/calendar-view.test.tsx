import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CalendarView } from '@web/components/calendar/calendar-view'
import { atIndex } from '@web/lib/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock FullCalendar to avoid complex DOM rendering
const mockChangeView = vi.fn()
const mockGotoDate = vi.fn()
const mockPrev = vi.fn()
const mockNext = vi.fn()
const mockToday = vi.fn()
const mockGetDate = vi.fn(() => new Date(2025, 2, 7))

vi.mock('@fullcalendar/react', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function MockFullCalendar(
      props: Record<string, unknown>,
      ref: React.Ref<unknown>,
    ) {
      React.useImperativeHandle(ref, () => ({
        getApi: () => ({
          changeView: mockChangeView,
          gotoDate: mockGotoDate,
          prev: mockPrev,
          next: mockNext,
          today: mockToday,
          getDate: mockGetDate,
          view: { type: 'timeGridDay' },
        }),
      }))
      const initialView =
        typeof props['initialView'] === 'string' ? props['initialView'] : ''
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

describe('CalendarView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with day view by default', () => {
    render(<CalendarView />)
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'timeGridDay',
    )
  })

  it('renders with week view when initialView is week', () => {
    render(<CalendarView initialView="week" />)
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'timeGridWeek',
    )
  })

  it('renders with month view when initialView is month', () => {
    render(<CalendarView initialView="month" />)
    expect(screen.getByTestId('fullcalendar')).toHaveAttribute(
      'data-view',
      'dayGridMonth',
    )
  })

  it('switches to week view when Week button is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarView />)

    const weekButtons = screen.getAllByText('Week')
    await user.click(atIndex(weekButtons, weekButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledWith('timeGridWeek')
  })

  it('switches to month view when Month button is clicked', async () => {
    const user = userEvent.setup()
    render(<CalendarView />)

    const monthButtons = screen.getAllByText('Month')
    await user.click(atIndex(monthButtons, monthButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledWith('dayGridMonth')
  })

  it('switches back to day view when Day button is clicked from week view', async () => {
    const user = userEvent.setup()
    render(<CalendarView initialView="week" />)

    const dayButtons = screen.getAllByText('Day')
    await user.click(atIndex(dayButtons, dayButtons.length - 1))

    expect(mockChangeView).toHaveBeenCalledWith('timeGridDay')
  })

  it('navigates to day view on date click in month view', async () => {
    const user = userEvent.setup()
    render(<CalendarView initialView="month" />)

    // Click the mock calendar to trigger dateClick
    await user.click(screen.getByTestId('fullcalendar'))

    expect(mockGotoDate).toHaveBeenCalledWith(new Date(2025, 2, 15))
    expect(mockChangeView).toHaveBeenCalledWith('timeGridDay')
  })

  it('highlights active view button', () => {
    render(<CalendarView initialView="week" />)

    const weekButtons = screen.getAllByText('Week')
    const activeWeekButton = atIndex(weekButtons, weekButtons.length - 1)
    expect(activeWeekButton.className).toContain('bg-background')
  })
})
