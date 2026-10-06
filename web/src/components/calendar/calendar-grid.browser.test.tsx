import type {
  DateSelectArg,
  DatesSetArg,
  EventClickArg,
  EventContentArg,
  EventDropArg,
} from '@fullcalendar/core'
import type {
  EventReceiveArg,
  EventResizeDoneArg,
} from '@fullcalendar/interaction'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  type CalendarDndCallbacks,
  CalendarGrid,
} from '#components/calendar/calendar-grid'
import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { assertDefined } from '#lib/test-utils'

type ExternalEventData = {
  id: string
  title: string
  duration: { minutes: number }
  extendedProps: {
    taskId: string
    type: string
    sourceQueueKey: string | undefined
    sourceDate: string | undefined
  }
}

type DraggableOptions = {
  itemSelector: string
  eventData: (element: HTMLElement) => ExternalEventData
}

let capturedProps: Record<string, unknown> = {}
let capturedDraggableOptions: DraggableOptions | undefined
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
// Real ESM import bindings are checked statically, so the mock must still
// provide every named export `calendar-grid.tsx` imports (`Draggable`), even
// though this test never exercises the external-drag code path.
vi.mock('@fullcalendar/interaction', () => ({
  default: {},
  Draggable: class {
    constructor(_container: HTMLElement, options: DraggableOptions) {
      capturedDraggableOptions = options
    }

    destroy() {}
  },
}))

function renderAndGetEventDrop(
  onEventDrop: NonNullable<CalendarDndCallbacks['onEventDrop']>,
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

function renderAndGetEventReceive(
  onExternalDrop: NonNullable<CalendarDndCallbacks['onExternalDrop']>,
) {
  render(
    <CalendarGrid
      events={[]}
      activeView="day"
      dndCallbacks={{ onExternalDrop }}
    />,
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventReceive handler
  return capturedProps['eventReceive'] as (info: EventReceiveArg) => void
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
    capturedDraggableOptions = undefined
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
        extendedProps: { type: 'manual', taskId: 'task-1' },
      },
      oldEvent: {
        start: new Date('2026-07-20T09:00:00'),
        end: new Date('2026-07-20T10:00:00'),
        allDay: false,
        extendedProps: { type: 'manual', taskId: 'task-1' },
      },
      el: document.createElement('div'),
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    expect(onEventDrop).not.toHaveBeenCalled()
    expect(revert).toHaveBeenCalledTimes(1)
  })

  it('sorts day queue events before title-based calendar events', () => {
    render(<CalendarGrid events={[]} activeView="week" />)

    expect(capturedProps['eventOrder']).toBe(
      'queueOrder,queuePosition,start,-duration,allDay,title',
    )
  })

  it('keeps day queue events draggable without allowing resize', () => {
    const event = makeTimeBlockEvent({
      id: 'day-queue-2026-07-20-queued-sample-a',
      title: 'Sample task',
      start: '2026-07-20',
      end: '2026-07-21',
      type: 'day-queue',
      taskId: 'queued-sample-a',
      allDay: true,
      queuePosition: 2,
    })
    render(<CalendarGrid events={[event]} activeView="week" />)

    expect(capturedProps['events']).toEqual([
      {
        id: event.id,
        title: event.title,
        start: event.start,
        end: event.end,
        allDay: true,
        queueOrder: 0,
        queuePosition: 2,
        editable: true,
        durationEditable: false,
        extendedProps: {
          type: 'day-queue',
          parentRef: undefined,
          color: undefined,
          taskId: 'queued-sample-a',
          isAutoScheduled: undefined,
          scheduleId: undefined,
          scheduleStart: event.start,
          queuePosition: 2,
          redacted: undefined,
          calendarColor: undefined,
          responseStatus: undefined,
          gcalEventType: undefined,
        },
      },
    ])
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
        extendedProps: { type: 'manual', taskId: 'task-1' },
      },
      oldEvent: {
        start: null,
        end: null,
        allDay: false,
        extendedProps: { type: 'manual', taskId: 'task-1' },
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
        extendedProps: { type: 'manual', taskId: 'task-1' },
      },
      oldEvent: {
        start: oldStart,
        end: oldEnd,
        allDay: false,
        extendedProps: { type: 'manual', taskId: 'task-1' },
      },
      el,
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop(dropInfo as unknown as EventDropArg)

    const getActual = () => ({
      calls: onEventDrop.mock.calls,
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({
      calls: [
        [
          {
            eventId: 'task-1',
            eventType: 'manual',
            taskId: 'task-1',
            isAllDay: false,
            wasAllDay: false,
            newStart,
            newEnd,
            oldStart,
            oldEnd,
            el,
            revert,
          },
        ],
      ],
      revertCalls: [],
    })
  })

  it('forwards a day queue event moved to a different all-day date', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    const eventDrop = renderAndGetEventDrop(onEventDrop)
    const newStart = new Date('2026-07-21T00:00:00')
    const newEnd = new Date('2026-07-22T00:00:00')
    const oldStart = new Date('2026-07-20T00:00:00')
    const oldEnd = new Date('2026-07-21T00:00:00')
    const el = document.createElement('div')

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop({
      event: {
        id: 'day-queue-2026-07-21-queued-sample-a',
        start: newStart,
        end: newEnd,
        allDay: true,
        extendedProps: { type: 'day-queue', taskId: 'queued-sample-a' },
      },
      oldEvent: {
        start: oldStart,
        end: oldEnd,
        allDay: true,
        extendedProps: { type: 'day-queue', taskId: 'queued-sample-a' },
      },
      el,
      revert,
    } as unknown as EventDropArg)

    const getActual = () => ({
      calls: onEventDrop.mock.calls,
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({
      calls: [
        [
          {
            eventId: 'day-queue-2026-07-21-queued-sample-a',
            eventType: 'day-queue',
            taskId: 'queued-sample-a',
            isAllDay: true,
            wasAllDay: true,
            newStart,
            newEnd,
            oldStart,
            oldEnd,
            el,
            revert,
          },
        ],
      ],
      revertCalls: [],
    })
  })

  it('reverts a Google Calendar all-day event drop', () => {
    const onEventDrop = vi.fn()
    const revert = vi.fn()
    const eventDrop = renderAndGetEventDrop(onEventDrop)

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventDrop reads
    eventDrop({
      event: {
        id: 'gcal-sample',
        start: new Date('2026-07-21T00:00:00'),
        end: new Date('2026-07-22T00:00:00'),
        allDay: true,
        extendedProps: { type: 'gcal-info' },
      },
      oldEvent: {
        start: new Date('2026-07-20T00:00:00'),
        end: new Date('2026-07-21T00:00:00'),
        allDay: true,
        extendedProps: { type: 'gcal-info' },
      },
      el: document.createElement('div'),
      revert,
    } as unknown as EventDropArg)

    const getActual = () => ({
      callbackCalls: onEventDrop.mock.calls,
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({ callbackCalls: [], revertCalls: [[]] })
  })

  it('forwards an external all-day drop to the queue callback', () => {
    const onExternalDrop = vi.fn()
    const eventReceive = renderAndGetEventReceive(onExternalDrop)
    const start = new Date('2026-07-22T00:00:00')
    const end = new Date('2026-07-23T00:00:00')
    const remove = vi.fn()

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleReceive reads
    eventReceive({
      event: {
        id: 'external-queued-sample-a',
        title: 'Prepare a sample outline',
        start,
        end,
        allDay: true,
        extendedProps: { taskId: 'queued-sample-a' },
        remove,
      },
    } as unknown as EventReceiveArg)

    const getActual = () => ({
      removeCalls: remove.mock.calls,
      dropCalls: onExternalDrop.mock.calls,
    })
    expect(getActual()).toEqual({
      removeCalls: [[]],
      dropCalls: [
        [
          {
            taskId: 'queued-sample-a',
            taskTitle: 'Prepare a sample outline',
            start,
            end,
            allDay: true,
            sourceQueueKey: undefined,
            sourceDate: undefined,
          },
        ],
      ],
    })
  })

  it('forwards the queue source metadata from the draggable row to the drop callback', () => {
    const dragContainer = document.createElement('div')
    const queueElement = document.createElement('div')
    queueElement.dataset['queueKey'] = 'week'
    queueElement.dataset['queueDate'] = '2026-07-20'
    const taskElement = document.createElement('div')
    taskElement.dataset['taskId'] = 'queued-sample-a'
    taskElement.dataset['taskTitle'] = 'Prepare a sample outline'
    taskElement.dataset['estimatedMinutes'] = '45'
    queueElement.append(taskElement)
    dragContainer.append(queueElement)

    const onExternalDrop = vi.fn()
    const externalDragContainerRef = { current: dragContainer }
    render(
      <CalendarGrid
        events={[]}
        activeView="day"
        externalDragContainerRef={externalDragContainerRef}
        dndCallbacks={{ onExternalDrop }}
      />,
    )

    const draggableOptions = assertDefined(capturedDraggableOptions)
    const eventData = draggableOptions.eventData(taskElement)
    const start = new Date('2026-07-22T00:00:00')
    const end = new Date('2026-07-23T00:00:00')
    const remove = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- captured prop is the real FullCalendar eventReceive handler
    const eventReceive = capturedProps['eventReceive'] as (
      info: EventReceiveArg,
    ) => void
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the test uses eventData output with eventReceive fields consumed by CalendarGrid
    eventReceive({
      event: {
        id: eventData.id,
        title: eventData.title,
        start,
        end,
        allDay: true,
        extendedProps: eventData.extendedProps,
        remove,
      },
    } as unknown as EventReceiveArg)

    const getActual = () => ({
      draggable: {
        itemSelector: draggableOptions.itemSelector,
        eventData,
      },
      removeCalls: remove.mock.calls,
      dropCalls: onExternalDrop.mock.calls,
    })
    expect(getActual()).toEqual({
      draggable: {
        itemSelector: '[data-task-id]',
        eventData: {
          id: 'external-queued-sample-a',
          title: 'Prepare a sample outline',
          duration: { minutes: 45 },
          extendedProps: {
            taskId: 'queued-sample-a',
            type: 'manual',
            sourceQueueKey: 'week',
            sourceDate: '2026-07-20',
          },
        },
      },
      removeCalls: [[]],
      dropCalls: [
        [
          {
            taskId: 'queued-sample-a',
            taskTitle: 'Prepare a sample outline',
            start,
            end,
            allDay: true,
            sourceQueueKey: 'week',
            sourceDate: '2026-07-20',
          },
        ],
      ],
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
        extendedProps: { type: 'manual' },
      },
      oldEvent: {
        start: null,
        end: null,
        extendedProps: { type: 'manual' },
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
        extendedProps: { type: 'manual' },
      },
      oldEvent: {
        start: oldStart,
        end: oldEnd,
        extendedProps: { type: 'manual' },
      },
      el,
      revert,
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test only exercises the fields handleEventResize reads
    eventResize(resizeInfo as unknown as EventResizeDoneArg)

    const getActual = () => ({
      calls: onEventResize.mock.calls,
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({
      calls: [
        [
          {
            eventId: 'task-1',
            newStart,
            newEnd,
            oldStart,
            oldEnd,
            el,
            revert,
          },
        ],
      ],
      revertCalls: [],
    })
  })

  it('reverts a resize of a day queue event', () => {
    const onEventResize = vi.fn()
    const revert = vi.fn()
    const eventResize = renderAndGetEventResize(onEventResize)
    const start = new Date('2026-07-20T00:00:00')
    const end = new Date('2026-07-21T00:00:00')

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the test exercises day queue fields consumed by CalendarGrid
    eventResize({
      event: {
        id: 'day-queue-2026-07-20-queued-sample-a',
        start,
        end,
        allDay: true,
        extendedProps: { type: 'day-queue', taskId: 'queued-sample-a' },
      },
      oldEvent: {
        id: 'day-queue-2026-07-20-queued-sample-a',
        start,
        end,
        allDay: true,
        extendedProps: { type: 'day-queue', taskId: 'queued-sample-a' },
      },
      revert,
    } as unknown as EventResizeDoneArg)

    const getActual = () => ({
      calls: onEventResize.mock.calls,
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({ calls: [], revertCalls: [[]] })
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

  it('uses the provided initialScrollTime instead of the computed default', () => {
    render(
      <CalendarGrid
        events={[]}
        activeView="day"
        initialScrollTime="22:00:00"
      />,
    )
    expect(capturedProps['scrollTime']).toBe('22:00:00')
  })
})
