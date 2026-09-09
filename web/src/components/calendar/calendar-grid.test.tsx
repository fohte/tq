import type { DateSelectArg, EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
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
    oldStart: Date
    oldEnd: Date
    el: HTMLElement
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

function renderAndGetEventResize(
  onEventResize: (info: {
    eventId: string
    newStart: Date
    newEnd: Date
    oldStart: Date
    oldEnd: Date
    el: HTMLElement
    revert: () => void
  }) => void,
) {
  render(
    <CalendarGrid
      events={[]}
      activeView="day"
      dndCallbacks={{ onEventResize }}
    />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventResize handler
  return capturedProps['eventResize'] as (info: EventResizeDoneArg) => void
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

  it('reverts the drag when the pre-drag event has no start/end', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    const eventDrop = renderAndGetEventDrop(onEventDrop)
    const dropInfo = {
      event: {
        id: 'task-1',
        start: new Date('2026-07-20T09:00:00'),
        end: new Date('2026-07-20T10:00:00'),
        allDay: false,
      },
      oldEvent: {
        start: null,
        end: null,
      },
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    expect(onEventDrop).not.toHaveBeenCalled()
    expect(revert).toHaveBeenCalledTimes(1)
  })

  it('forwards new/old start-end, the element, and revert to onEventDrop when a timed event is dropped', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    const eventDrop = renderAndGetEventDrop(onEventDrop)
    const newStart = new Date('2026-07-20T09:00:00')
    const newEnd = new Date('2026-07-20T10:00:00')
    const oldStart = new Date('2026-07-20T08:00:00')
    const oldEnd = new Date('2026-07-20T09:00:00')
    const el = document.createElement('div')
    const dropInfo = {
      event: {
        id: 'task-1',
        start: newStart,
        end: newEnd,
        allDay: false,
      },
      oldEvent: {
        start: oldStart,
        end: oldEnd,
      },
      el,
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    expect(revert).not.toHaveBeenCalled()
    expect(onEventDrop).toHaveBeenCalledWith({
      eventId: 'task-1',
      newStart,
      newEnd,
      oldStart,
      oldEnd,
      el,
      revert,
    })
  })

  it('reverts the resize when the pre-resize event has no start/end', () => {
    const onEventResize = vi.fn()
    const revert = vi.fn()
    const eventResize = renderAndGetEventResize(onEventResize)
    const resizeInfo = {
      event: {
        id: 'task-1',
        start: new Date('2026-07-20T09:00:00'),
        end: new Date('2026-07-20T11:00:00'),
      },
      oldEvent: {
        start: null,
        end: null,
      },
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventResize reads
    eventResize(resizeInfo as unknown as EventResizeDoneArg)

    expect(onEventResize).not.toHaveBeenCalled()
    expect(revert).toHaveBeenCalledTimes(1)
  })

  it('forwards new/old start-end, the element, and revert to onEventResize when an event is resized', () => {
    const onEventResize = vi.fn()
    const revert = vi.fn()
    const eventResize = renderAndGetEventResize(onEventResize)
    const newStart = new Date('2026-07-20T09:00:00')
    const newEnd = new Date('2026-07-20T11:00:00')
    const oldStart = new Date('2026-07-20T09:00:00')
    const oldEnd = new Date('2026-07-20T10:00:00')
    const el = document.createElement('div')
    const resizeInfo = {
      event: {
        id: 'task-1',
        start: newStart,
        end: newEnd,
      },
      oldEvent: {
        start: oldStart,
        end: oldEnd,
      },
      el,
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventResize reads
    eventResize(resizeInfo as unknown as EventResizeDoneArg)

    expect(revert).not.toHaveBeenCalled()
    expect(onEventResize).toHaveBeenCalledWith({
      eventId: 'task-1',
      newStart,
      newEnd,
      oldStart,
      oldEnd,
      el,
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
})
