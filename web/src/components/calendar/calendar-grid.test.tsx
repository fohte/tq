import type {
  DateSelectArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from '@fullcalendar/core'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarGrid } from '#components/calendar/calendar-grid'

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

function renderAndGetEventDrop(
  onEventDrop: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    revert: () => void
  }) => void,
) {
  render(
    <CalendarGrid
      events={[]}
      activeView="day"
      dndCallbacks={{ onEventDrop }}
    />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventDrop handler
  return capturedProps['eventDrop'] as (info: EventDropArg) => void
}

function renderAndGetSelect(
  onSelectRange: (info: { start: Date; end: Date }) => void,
) {
  render(
    <CalendarGrid events={[]} activeView="day" onSelectRange={onSelectRange} />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar select handler
  return capturedProps['select'] as (info: DateSelectArg) => void
}

function renderAndGetEventClick({
  onScheduleClick,
  onTaskClick,
}: {
  onScheduleClick?: (scheduleId: string, start: string) => void
  onTaskClick?: (taskId: string) => void
}) {
  render(
    <CalendarGrid
      events={[]}
      activeView="day"
      onScheduleClick={onScheduleClick}
      onTaskClick={onTaskClick}
    />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventClick handler
  return capturedProps['eventClick'] as (info: EventClickArg) => void
}

function renderAndGetEventClassNames() {
  render(<CalendarGrid events={[]} activeView="day" />)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventClassNames handler
  return capturedProps['eventClassNames'] as (arg: EventContentArg) => string[]
}

describe('CalendarGrid', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  it('reverts the drag instead of updating the time block when dropped on the all-day row', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    const eventDrop = renderAndGetEventDrop(onEventDrop)
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
    const eventDrop = renderAndGetEventDrop(onEventDrop)
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

  it('reports the selected range when a time-grid selection is made', () => {
    const onSelectRange = vi.fn()
    const select = renderAndGetSelect(onSelectRange)
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T09:30:00')

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleSelect reads
    select({ start, end, allDay: false } as unknown as DateSelectArg)

    expect(onSelectRange).toHaveBeenCalledExactlyOnceWith({ start, end })
  })

  it('ignores an all-day row selection', () => {
    const onSelectRange = vi.fn()
    const select = renderAndGetSelect(onSelectRange)
    const start = new Date('2026-07-20T00:00:00')
    const end = new Date('2026-07-21T00:00:00')

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleSelect reads
    select({ start, end, allDay: true } as unknown as DateSelectArg)

    expect(onSelectRange).not.toHaveBeenCalled()
  })

  it('routes a manual event click to onTaskClick', () => {
    const onScheduleClick = vi.fn()
    const onTaskClick = vi.fn()
    const eventClick = renderAndGetEventClick({ onScheduleClick, onTaskClick })
    const info = {
      event: { extendedProps: { type: 'manual', taskId: 'task-1' } },
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventClick reads
    eventClick(info as unknown as EventClickArg)

    expect(onTaskClick).toHaveBeenCalledExactlyOnceWith('task-1')
    expect(onScheduleClick).not.toHaveBeenCalled()
  })

  it('routes a schedule event click to onScheduleClick', () => {
    const onScheduleClick = vi.fn()
    const onTaskClick = vi.fn()
    const eventClick = renderAndGetEventClick({ onScheduleClick, onTaskClick })
    const info = {
      event: {
        extendedProps: {
          type: 'schedule',
          scheduleId: 'sched-1',
          scheduleStart: '2026-07-20T09:00:00',
        },
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventClick reads
    eventClick(info as unknown as EventClickArg)

    expect(onScheduleClick).toHaveBeenCalledExactlyOnceWith(
      'sched-1',
      '2026-07-20T09:00:00',
    )
    expect(onTaskClick).not.toHaveBeenCalled()
  })

  it('ignores a gcal event click', () => {
    const onScheduleClick = vi.fn()
    const onTaskClick = vi.fn()
    const eventClick = renderAndGetEventClick({ onScheduleClick, onTaskClick })
    const info = {
      event: { extendedProps: { type: 'gcal-meeting' } },
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventClick reads
    eventClick(info as unknown as EventClickArg)

    expect(onTaskClick).not.toHaveBeenCalled()
    expect(onScheduleClick).not.toHaveBeenCalled()
  })

  it('ignores a redacted event click', () => {
    const onScheduleClick = vi.fn()
    const onTaskClick = vi.fn()
    const eventClick = renderAndGetEventClick({ onScheduleClick, onTaskClick })
    const info = {
      event: {
        extendedProps: { type: 'manual', taskId: 'task-1', redacted: true },
      },
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventClick reads
    eventClick(info as unknown as EventClickArg)

    expect(onTaskClick).not.toHaveBeenCalled()
  })

  it('marks a manual event as clickable', () => {
    const eventClassNames = renderAndGetEventClassNames()
    const arg = { event: { extendedProps: { type: 'manual' } } }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields eventClassNames reads
    expect(eventClassNames(arg as unknown as EventContentArg)).toEqual([
      'tq-event-clickable',
    ])
  })

  it('does not mark a gcal event as clickable', () => {
    const eventClassNames = renderAndGetEventClassNames()
    const arg = { event: { extendedProps: { type: 'gcal-meeting' } } }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields eventClassNames reads
    expect(eventClassNames(arg as unknown as EventContentArg)).toEqual([])
  })

  it('does not mark a redacted event as clickable', () => {
    const eventClassNames = renderAndGetEventClassNames()
    const arg = {
      event: { extendedProps: { type: 'manual', redacted: true } },
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields eventClassNames reads
    expect(eventClassNames(arg as unknown as EventContentArg)).toEqual([])
  })
})
