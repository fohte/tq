import { describe, expect, it } from 'vitest'

import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { buildNowPanelModel } from '#components/day-view/now-panel-model'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'

const now = new Date(2031, 3, 9, 14, 52)

function localTime(day: number, hour: number, minute = 0): string {
  return `2031-04-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
}

function block(id: string, taskId: string, startTime: string, endTime: string) {
  return makeTimeBlock({ id, taskId, startTime, endTime })
}

function blockEvent(
  timeBlock: TimeBlock,
  title: string,
  type: 'manual' | 'completed' = 'manual',
) {
  return makeTimeBlockEvent({
    id: timeBlock.id,
    title,
    start: timeBlock.startTime,
    end: timeBlock.endTime,
    type,
    taskId: timeBlock.taskId,
  })
}

function taskMap(...tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]))
}

describe('buildNowPanelModel', () => {
  it('shows overlapping tasks in start order and selects the next time block', () => {
    const taskA = makeTask({ id: 'task-a', title: 'Prepare release notes' })
    const taskB = makeTask({ id: 'task-b', title: 'Review service logs' })
    const taskC = makeTask({ id: 'task-c', title: 'Update dashboard copy' })
    const blockA = block(
      'block-a',
      taskA.id,
      localTime(9, 14),
      localTime(9, 15),
    )
    const blockB = block(
      'block-b',
      taskB.id,
      localTime(9, 14, 30),
      localTime(9, 15, 30),
    )
    const blockC = block(
      'block-c',
      taskC.id,
      localTime(9, 15, 45),
      localTime(9, 16, 15),
    )

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [blockB, blockC, blockA],
        calendarEvents: [
          blockEvent(blockB, taskB.title),
          blockEvent(blockC, taskC.title),
          blockEvent(blockA, taskA.title),
        ],
        tasks: taskMap(taskA, taskB, taskC),
      }),
    ).toEqual({
      activities: [
        {
          kind: 'task',
          key: 'block-a',
          task: taskA,
          statusLabel: 'now (8 min left)',
          isOverrun: false,
        },
        {
          kind: 'task',
          key: 'block-b',
          task: taskB,
          statusLabel: 'now (38 min left)',
          isOverrun: false,
        },
      ],
      emptyState: null,
      nextEvent: { title: taskC.title, minutesUntil: 53, isWarning: false },
    })
  })

  it('orders overrun tasks by block start and excludes completed tasks', () => {
    const unfinished = makeTask({ id: 'unfinished', title: 'Check the build' })
    const active = makeTask({ id: 'active', title: 'Review the release plan' })
    const completed = makeTask({ id: 'completed', status: 'completed' })
    const ended = block(
      'block-ended',
      unfinished.id,
      localTime(9, 14),
      localTime(9, 14, 50),
    )
    const activeBlock = block(
      'block-active',
      active.id,
      localTime(9, 14, 51),
      localTime(9, 14, 55),
    )
    const completedBlock = block(
      'block-completed',
      completed.id,
      localTime(9, 14),
      localTime(9, 14, 40),
    )

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [ended, activeBlock, completedBlock],
        calendarEvents: [
          blockEvent(ended, unfinished.title),
          blockEvent(activeBlock, active.title),
          blockEvent(completedBlock, completed.title, 'completed'),
        ],
        tasks: taskMap(unfinished, active, completed),
      }),
    ).toEqual({
      activities: [
        {
          kind: 'task',
          key: 'block-ended',
          task: unfinished,
          statusLabel: 'block ended 2 min ago',
          isOverrun: true,
        },
        {
          kind: 'task',
          key: 'block-active',
          task: active,
          statusLabel: 'now (3 min left)',
          isOverrun: false,
        },
      ],
      emptyState: null,
      nextEvent: null,
    })
  })

  it('shows one row per task and prefers its active block over an ended block', () => {
    const task = makeTask({
      id: 'task-repeat',
      title: 'Review the release plan',
    })
    const ended = block(
      'block-ended',
      task.id,
      localTime(9, 9),
      localTime(9, 10),
    )
    const active = block(
      'block-active',
      task.id,
      localTime(9, 14),
      localTime(9, 15, 14),
    )

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [ended, active],
        calendarEvents: [
          blockEvent(ended, task.title),
          blockEvent(active, task.title),
        ],
        tasks: taskMap(task),
      }),
    ).toEqual({
      activities: [
        {
          kind: 'task',
          key: 'block-active',
          task,
          statusLabel: 'now (22 min left)',
          isOverrun: false,
        },
      ],
      emptyState: null,
      nextEvent: null,
    })
  })

  it('hides ended and upcoming blocks when their tasks are outside the current context', () => {
    const ended = block(
      'hidden-ended',
      'hidden-task',
      localTime(9, 9),
      localTime(9, 10),
    )
    const upcoming = block(
      'hidden-upcoming',
      'hidden-task-next',
      localTime(9, 15),
      localTime(9, 15, 30),
    )

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [ended, upcoming],
        calendarEvents: [
          blockEvent(ended, 'Private task'),
          blockEvent(upcoming, 'Another private task'),
        ],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [],
      emptyState: 'no-block-now',
      nextEvent: null,
    })
  })

  it('replaces a redacted active event title with Busy', () => {
    const privateMeeting = makeTimeBlockEvent({
      id: 'meeting-private',
      title: 'Private appointment',
      start: localTime(9, 14),
      end: localTime(9, 15, 14),
      type: 'gcal-meeting',
      redacted: true,
    })

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [],
        calendarEvents: [privateMeeting],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [
        {
          kind: 'event',
          key: 'meeting-private',
          title: 'Busy',
          statusLabel: 'now (22 min left)',
          isOverrun: false,
        },
      ],
      emptyState: null,
      nextEvent: null,
    })
  })

  it('shows an active meeting and warns for a meeting starting within five minutes', () => {
    const activeMeeting = makeTimeBlockEvent({
      id: 'meeting-current',
      title: 'Product review',
      start: localTime(9, 14),
      end: localTime(9, 15, 14),
      type: 'gcal-meeting',
      meetingUrl: 'https://meet.example.com/current-room',
    })
    const nextMeeting = makeTimeBlockEvent({
      id: 'meeting-next',
      title: 'Planning call',
      start: localTime(9, 14, 57),
      end: localTime(9, 15, 27),
      type: 'gcal-meeting',
      meetingUrl: 'https://meet.example.com/next-room',
    })

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [],
        calendarEvents: [activeMeeting, nextMeeting],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [
        {
          kind: 'event',
          key: 'meeting-current',
          title: 'Product review',
          statusLabel: 'now (22 min left)',
          isOverrun: false,
          meetingUrl: 'https://meet.example.com/current-room',
        },
      ],
      emptyState: null,
      nextEvent: {
        title: 'Planning call',
        minutesUntil: 5,
        isWarning: true,
        meetingUrl: 'https://meet.example.com/next-room',
      },
    })
  })

  it('finds the next schedule across midnight and ignores all-day or declined events', () => {
    const nextSchedule = makeTimeBlockEvent({
      id: 'schedule-next-day',
      title: 'Evening routine',
      start: localTime(10, 0),
      end: localTime(10, 0, 30),
      type: 'schedule',
      scheduleId: 'schedule-routine',
    })
    const allDayEvent = makeTimeBlockEvent({
      id: 'event-all-day',
      title: 'Holiday',
      start: localTime(10, 0),
      end: localTime(10, 23, 59),
      type: 'gcal-solo',
      allDay: true,
    })
    const declinedMeeting = makeTimeBlockEvent({
      id: 'meeting-declined',
      title: 'Declined call',
      start: localTime(9, 23, 55),
      end: localTime(9, 23, 59),
      type: 'gcal-meeting',
      responseStatus: 'declined',
    })

    expect(
      buildNowPanelModel({
        now: new Date(2031, 3, 9, 23, 52),
        timeBlocks: [],
        calendarEvents: [allDayEvent, declinedMeeting, nextSchedule],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [],
      emptyState: 'no-time-blocks-today',
      nextEvent: { title: 'Evening routine', minutesUntil: 8, isWarning: true },
    })
  })

  it('does not treat an overnight schedule continuation as a new upcoming event', () => {
    const firstPart = makeTimeBlockEvent({
      id: 'schedule-first-part',
      title: 'Evening routine',
      start: localTime(9, 23),
      end: localTime(10, 0),
      type: 'schedule',
      scheduleId: 'schedule-routine',
    })
    const continuation = makeTimeBlockEvent({
      id: 'schedule-continuation',
      title: 'Evening routine',
      start: localTime(10, 0),
      end: localTime(10, 1),
      type: 'schedule',
      scheduleId: 'schedule-routine',
    })

    expect(
      buildNowPanelModel({
        now: new Date(2031, 3, 9, 23, 52),
        timeBlocks: [],
        calendarEvents: [firstPart, continuation],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [],
      emptyState: 'no-time-blocks-today',
      nextEvent: null,
    })
  })

  it('notes when there are no time blocks today', () => {
    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [],
        calendarEvents: [],
        tasks: taskMap(),
      }),
    ).toEqual({
      activities: [],
      emptyState: 'no-time-blocks-today',
      nextEvent: null,
    })
  })

  it('shows a gap before the next block', () => {
    const task = makeTask({ id: 'task-next', title: 'Write a status update' })
    const upcomingBlock = block(
      'block-next',
      task.id,
      localTime(9, 15),
      localTime(9, 15, 30),
    )

    expect(
      buildNowPanelModel({
        now,
        timeBlocks: [upcomingBlock],
        calendarEvents: [blockEvent(upcomingBlock, task.title)],
        tasks: taskMap(task),
      }),
    ).toEqual({
      activities: [],
      emptyState: 'no-block-now',
      nextEvent: { title: task.title, minutesUntil: 8, isWarning: false },
    })
  })
})
