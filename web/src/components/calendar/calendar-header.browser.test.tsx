import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { CalendarHeader } from '#components/calendar/calendar-header'

const currentDate = new Date(2025, 2, 7)

describe('CalendarHeader', () => {
  it('displays the formatted date and weekday', () => {
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewChange={vi.fn()}
      />,
    )

    expect(screen.getByText('2025-03-07')).toBeVisible()
    expect(screen.getByText('Fri')).toBeVisible()
  })

  it('marks the active view as pressed', () => {
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewChange={vi.fn()}
      />,
    )

    expect(screen.getByText('day')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('week')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('month')).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onPrev when the previous button is clicked', async () => {
    const onPrev = vi.fn()
    const user = userEvent.setup()
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={onPrev}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewChange={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Previous'))

    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('calls onNext when the next button is clicked', async () => {
    const onNext = vi.fn()
    const user = userEvent.setup()
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={vi.fn()}
        onNext={onNext}
        onToday={vi.fn()}
        onViewChange={vi.fn()}
      />,
    )

    await user.click(screen.getByLabelText('Next'))

    expect(onNext).toHaveBeenCalledOnce()
  })

  it('calls onToday when the today button is clicked', async () => {
    const onToday = vi.fn()
    const user = userEvent.setup()
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={onToday}
        onViewChange={vi.fn()}
      />,
    )

    await user.click(screen.getByText('today'))

    expect(onToday).toHaveBeenCalledOnce()
  })

  it('calls onViewChange when a view button is clicked', async () => {
    const onViewChange = vi.fn()
    const user = userEvent.setup()
    render(
      <CalendarHeader
        currentDate={currentDate}
        activeView="day"
        onPrev={vi.fn()}
        onNext={vi.fn()}
        onToday={vi.fn()}
        onViewChange={onViewChange}
      />,
    )

    await user.click(screen.getByText('month'))

    expect(onViewChange).toHaveBeenCalledWith('month')
  })
})
