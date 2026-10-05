import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { NowPanel, type NowPanelProps } from '#components/day-view/now-panel'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { StoryRouter } from '#storybook-config/story-router'

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
  taskId = timeBlock.taskId,
) {
  return makeTimeBlockEvent({
    id: timeBlock.id,
    title,
    start: timeBlock.startTime,
    end: timeBlock.endTime,
    type: 'manual',
    taskId,
  })
}

function taskMap(...tasks: Task[]): Map<string, Task> {
  return new Map(tasks.map((task) => [task.id, task]))
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <div className="w-80">{children}</div>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function NowPanelStory(props: NowPanelProps) {
  return (
    <Providers>
      <NowPanel {...props} />
    </Providers>
  )
}

const meta = {
  title: 'DayView/NowPanel',
  component: NowPanelStory,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NowPanelStory>

export default meta
type Story = StoryObj<typeof meta>

const taskA = makeTask({
  id: 'task-a',
  number: 41,
  title: 'Prepare release notes',
})
const taskB = makeTask({
  id: 'task-b',
  number: 42,
  title: 'Review service logs',
})
const taskC = makeTask({
  id: 'task-c',
  number: 43,
  title: 'Update dashboard copy',
})

const activeA = block('block-a', taskA.id, localTime(9, 14), localTime(9, 15))
const activeB = block(
  'block-b',
  taskB.id,
  localTime(9, 14, 30),
  localTime(9, 15, 30),
)
const nextC = block(
  'block-c',
  taskC.id,
  localTime(9, 15, 45),
  localTime(9, 16, 15),
)

export const CurrentTask: Story = {
  name: 'a time block shows the task with time left',
  args: {
    now,
    timeBlocks: [activeA],
    calendarEvents: [blockEvent(activeA, taskA.title)],
    taskMap: taskMap(taskA),
  },
}

export const ParallelTasks: Story = {
  name: 'overlapping time blocks show every task in start order',
  args: {
    now,
    timeBlocks: [activeB, nextC, activeA],
    calendarEvents: [
      blockEvent(activeB, taskB.title),
      blockEvent(nextC, taskC.title),
      blockEvent(activeA, taskA.title),
    ],
    taskMap: taskMap(taskA, taskB, taskC),
  },
}

const endedBlock = block(
  'block-ended',
  taskA.id,
  localTime(9, 14),
  localTime(9, 14, 50),
)
const bathStart = localTime(9, 15)

export const BlockOverrun: Story = {
  name: 'an unfinished task stays visible after its block ends',
  args: {
    now,
    timeBlocks: [endedBlock],
    calendarEvents: [
      blockEvent(endedBlock, taskA.title),
      makeTimeBlockEvent({
        id: 'schedule-bath',
        title: 'Evening routine',
        start: bathStart,
        end: localTime(9, 15, 30),
        type: 'schedule',
        scheduleId: 'schedule-bath',
      }),
    ],
    taskMap: taskMap(taskA),
  },
}

export const MeetingInProgress: Story = {
  name: 'a meeting appears while it is in progress',
  args: {
    now,
    timeBlocks: [],
    calendarEvents: [
      makeTimeBlockEvent({
        id: 'meeting-current',
        title: 'Product review',
        start: localTime(9, 14),
        end: localTime(9, 15, 14),
        type: 'gcal-meeting',
      }),
    ],
    taskMap: taskMap(),
  },
}

export const NoBlockNow: Story = {
  name: 'the panel shows when no block is active',
  args: {
    now,
    timeBlocks: [nextC],
    calendarEvents: [blockEvent(nextC, taskC.title)],
    taskMap: taskMap(taskC),
  },
}

export const NoTimeBlocksToday: Story = {
  name: 'the panel notes when there are no time blocks today',
  args: {
    now: new Date(2031, 3, 9, 23, 52),
    timeBlocks: [],
    calendarEvents: [],
    taskMap: taskMap(),
  },
}

export const Loading: Story = {
  name: 'the panel shows a loading message while its data loads',
  args: {
    now,
    timeBlocks: [],
    calendarEvents: [],
    taskMap: taskMap(),
    isLoading: true,
  },
}

export const DesktopWindowControls: Story = {
  name: 'the Now panel reserves space for the desktop window controls',
  args: {
    desktopWindowControls: true,
    now,
    timeBlocks: [],
    calendarEvents: [],
    taskMap: taskMap(),
  },
}

export const UpcomingScheduleWarning: Story = {
  name: 'the next recurring schedule turns red ten minutes before it starts',
  args: {
    now,
    timeBlocks: [],
    calendarEvents: [
      makeTimeBlockEvent({
        id: 'schedule-bath',
        title: 'Evening routine',
        start: bathStart,
        end: localTime(9, 15, 30),
        type: 'schedule',
        scheduleId: 'schedule-bath',
      }),
    ],
    taskMap: taskMap(),
  },
}

export const UpcomingMeetingWarning: Story = {
  name: 'the next meeting turns red five minutes before it starts',
  args: {
    now,
    timeBlocks: [],
    calendarEvents: [
      makeTimeBlockEvent({
        id: 'meeting-next',
        title: 'Planning call',
        start: localTime(9, 14, 57),
        end: localTime(9, 15, 27),
        type: 'gcal-meeting',
      }),
    ],
    taskMap: taskMap(),
  },
}
