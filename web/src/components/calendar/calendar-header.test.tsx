import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CalendarHeader,
  type CalendarViewType,
} from '@web/components/calendar/calendar-header'
import { atIndex } from '@web/lib/test-utils'
import { describe, expect, it, vi } from 'vitest'

function renderHeader(
  overrides: Partial<Parameters<typeof CalendarHeader>[0]> = {},
) {
  const props = {
    currentDate: new Date(2025, 2, 7), // March 7, 2025
    activeView: 'day' as CalendarViewType,
    onPrev: vi.fn(),
    onNext: vi.fn(),
    onToday: vi.fn(),
    onViewChange: vi.fn(),
    ...overrides,
  }

  const { container } = render(<CalendarHeader {...props} />)
  return { props, container }
}

describe('CalendarHeader', () => {
  it('displays the formatted date with day of week', () => {
    renderHeader()
    const dateTexts = screen.getAllByText(/March 7, 2025/)
    expect(dateTexts.length).toBeGreaterThan(0)
    expect(atIndex(dateTexts, 0).textContent).toContain('Fri')
  })

  it('calls onPrev when previous button is clicked', async () => {
    const user = userEvent.setup()
    const { props, container } = renderHeader()

    const prevButtons = within(container).getAllByLabelText('Previous')
    // Base-UI renders duplicate elements; click the last one which is the visible button
    await user.click(atIndex(prevButtons, prevButtons.length - 1))
    expect(props.onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when next button is clicked', async () => {
    const user = userEvent.setup()
    const { props, container } = renderHeader()

    const nextButtons = within(container).getAllByLabelText('Next')
    await user.click(atIndex(nextButtons, nextButtons.length - 1))
    expect(props.onNext).toHaveBeenCalledOnce()
  })

  it('calls onToday when Today button is clicked', async () => {
    const user = userEvent.setup()
    const { props, container } = renderHeader()

    const todayButtons = within(container).getAllByText('Today')
    await user.click(atIndex(todayButtons, todayButtons.length - 1))
    expect(props.onToday).toHaveBeenCalledOnce()
  })

  it('highlights the active view', () => {
    renderHeader({ activeView: 'week' })
    const weekButtons = screen.getAllByText('Week')
    // The last element is the visible one rendered by Base-UI
    expect(atIndex(weekButtons, weekButtons.length - 1).className).toContain(
      'bg-background',
    )
  })

  it('calls onViewChange when a view button is clicked', async () => {
    const user = userEvent.setup()
    const { props } = renderHeader({ activeView: 'day' })

    const monthButtons = screen.getAllByText('Month')
    await user.click(atIndex(monthButtons, monthButtons.length - 1))
    expect(props.onViewChange).toHaveBeenCalledWith('month')
  })

  it('renders all three view options', () => {
    renderHeader()
    expect(screen.getAllByText('Day').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Week').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Month').length).toBeGreaterThan(0)
  })
})
