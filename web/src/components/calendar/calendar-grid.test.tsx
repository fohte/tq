import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CalendarGrid } from '#components/calendar/calendar-grid'

let capturedProps: Record<string, unknown> = {}
const scrollToTimeSpy = vi.fn()

vi.mock('@fullcalendar/react', async () => {
  const React = await import('react')
  return {
    default: React.forwardRef(function MockFullCalendar(
      props: Record<string, unknown>,
      ref: React.Ref<{
        getApi: () => {
          view: { type: string }
          changeView: () => void
          scrollToTime: (time: string) => void
        }
      }>,
    ) {
      capturedProps = props
      React.useImperativeHandle(ref, () => ({
        getApi: () => ({
          // Matches whatever activeView resolves to, so the view-sync effect
          // in CalendarGrid sees no change and skips calling changeView.
          view: { type: String(props['initialView']) },
          changeView: () => {},
          scrollToTime: scrollToTimeSpy,
        }),
      }))
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

function renderAndGetDatesSet(
  onDatesSet?: (info: {
    start: Date
    end: Date
    view: { currentStart: Date }
  }) => void,
) {
  render(
    <CalendarGrid
      events={[]}
      activeView="day"
      {...(onDatesSet ? { onDatesSet } : {})}
    />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar datesSet handler
  return capturedProps['datesSet'] as (info: DatesSetArg) => void
}

describe('CalendarGrid', () => {
  beforeEach(() => {
    capturedProps = {}
    scrollToTimeSpy.mockClear()
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

  describe('datesSet', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('forwards the dates-set info to onDatesSet', () => {
      const onDatesSet = vi.fn()
      const datesSet = renderAndGetDatesSet(onDatesSet)
      const info = {
        start: new Date('2026-07-20T00:00:00'),
        end: new Date('2026-07-21T00:00:00'),
        view: { currentStart: new Date('2026-07-20T00:00:00') },
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleDatesSet reads
      datesSet(info as unknown as DatesSetArg)

      expect(onDatesSet).toHaveBeenCalledExactlyOnceWith(info)
    })

    it('scrolls to an hour before now when the displayed range includes the current moment', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 20, 14, 45, 0))
      const datesSet = renderAndGetDatesSet()
      const info = {
        start: new Date(2026, 6, 20, 0, 0, 0),
        end: new Date(2026, 6, 21, 0, 0, 0),
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleDatesSet reads
      datesSet(info as unknown as DatesSetArg)

      expect(scrollToTimeSpy).toHaveBeenCalledExactlyOnceWith('13:45:00')
    })

    it('keeps the default scroll time when the displayed range does not include the current moment', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 20, 14, 45, 0))
      const datesSet = renderAndGetDatesSet()
      const info = {
        start: new Date(2026, 6, 21, 0, 0, 0),
        end: new Date(2026, 6, 22, 0, 0, 0),
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleDatesSet reads
      datesSet(info as unknown as DatesSetArg)

      expect(scrollToTimeSpy).toHaveBeenCalledExactlyOnceWith('08:00:00')
    })

    it('clamps the scroll time to 00:00 within the first hour after midnight', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2026, 6, 20, 0, 30, 0))
      const datesSet = renderAndGetDatesSet()
      const info = {
        start: new Date(2026, 6, 20, 0, 0, 0),
        end: new Date(2026, 6, 21, 0, 0, 0),
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleDatesSet reads
      datesSet(info as unknown as DatesSetArg)

      expect(scrollToTimeSpy).toHaveBeenCalledExactlyOnceWith('00:00:00')
    })
  })
})
