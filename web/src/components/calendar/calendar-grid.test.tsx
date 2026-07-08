import type { EventDropArg } from '@fullcalendar/core'
import { render } from '@testing-library/react'
import { CalendarGrid } from '@web/components/calendar/calendar-grid'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let capturedProps: Record<string, unknown> = {}

vi.mock('@fullcalendar/react', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function MockFullCalendar(
      props: Record<string, unknown>,
    ) {
      capturedProps = props
      return null
    }),
  }
})

vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))

describe('CalendarGrid', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  it('reverts the drag instead of updating the time block when dropped on the all-day row', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    render(
      <CalendarGrid
        events={[]}
        activeView="day"
        dndCallbacks={{ onEventDrop }}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventDrop handler
    const eventDrop = capturedProps['eventDrop'] as (info: EventDropArg) => void
    const dropInfo = {
      event: {
        id: 'task-1',
        start: new Date('2026-07-20T00:00:00'),
        end: new Date('2026-07-21T00:00:00'),
        allDay: true,
      },
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    expect(onEventDrop).not.toHaveBeenCalled()
    expect(revert).toHaveBeenCalledTimes(1)
  })

  it('updates the time block with the new start/end when a timed event is dropped', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    render(
      <CalendarGrid
        events={[]}
        activeView="day"
        dndCallbacks={{ onEventDrop }}
      />,
    )

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventDrop handler
    const eventDrop = capturedProps['eventDrop'] as (info: EventDropArg) => void
    const newStart = new Date('2026-07-20T09:00:00')
    const newEnd = new Date('2026-07-20T10:00:00')
    const dropInfo = {
      event: {
        id: 'task-1',
        start: newStart,
        end: newEnd,
        allDay: false,
      },
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    expect(revert).not.toHaveBeenCalled()
    expect(onEventDrop).toHaveBeenCalledWith({
      eventId: 'task-1',
      newStart,
      newEnd,
      revert,
    })
  })
})
