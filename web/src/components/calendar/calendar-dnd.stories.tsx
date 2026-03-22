import type { Meta, StoryObj } from '@storybook/react-vite'
import type { CalendarDndCallbacks } from '@web/components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '@web/components/calendar/calendar-view'
import { useRef, useState } from 'react'

const today = new Date()
const dateStr = today.toISOString().slice(0, 10)

const sampleEvents: TimeBlockEvent[] = [
  {
    id: 'tb-1',
    title: 'API ドキュメント作成',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
    duration: '1h',
    label: 'dev:tq',
  },
  {
    id: 'tb-2',
    title: 'テスト追加',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'manual',
    duration: '1h',
  },
  {
    id: 'tb-3',
    title: 'Team standup',
    start: `${dateStr}T11:00:00`,
    end: `${dateStr}T11:30:00`,
    type: 'gcal',
  },
  {
    id: 'tb-4',
    title: 'PR レビュー',
    start: `${dateStr}T14:00:00`,
    end: `${dateStr}T15:00:00`,
    type: 'manual',
    duration: '1h',
  },
]

const sampleTasks = [
  { id: 'task-1', title: 'Deploy to staging', estimatedMinutes: 30 },
  { id: 'task-2', title: 'Write unit tests', estimatedMinutes: 60 },
  { id: 'task-3', title: 'Fix CI pipeline', estimatedMinutes: null },
]

function DndCalendarDemo() {
  const [events, setEvents] = useState<TimeBlockEvent[]>(sampleEvents)
  const [log, setLog] = useState<string[]>([])
  const taskListRef = useRef<HTMLDivElement>(null)

  const addLog = (msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 10))
  }

  const dndCallbacks: CalendarDndCallbacks = {
    onEventDrop: ({ eventId, newStart, newEnd }) => {
      addLog(
        `Moved ${eventId}: ${newStart.toLocaleTimeString()} - ${newEnd.toLocaleTimeString()}`,
      )
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
            : e,
        ),
      )
    },
    onEventResize: ({ eventId, newStart, newEnd }) => {
      addLog(
        `Resized ${eventId}: ${newStart.toLocaleTimeString()} - ${newEnd.toLocaleTimeString()}`,
      )
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, start: newStart.toISOString(), end: newEnd.toISOString() }
            : e,
        ),
      )
    },
    onExternalDrop: ({ taskTitle, start, end }) => {
      addLog(
        `External drop: ${taskTitle} at ${start.toLocaleTimeString()} - ${end.toLocaleTimeString()}`,
      )
      const newEvent: TimeBlockEvent = {
        id: `tb-new-${Date.now()}`,
        title: taskTitle,
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'manual',
      }
      setEvents((prev) => [...prev, newEvent])
    },
  }

  return (
    <div className="flex h-full">
      {/* Task list (drag source) */}
      <div
        ref={taskListRef}
        className="flex w-64 flex-col border-r border-border bg-background"
      >
        <div className="border-b border-border px-3 py-2 text-sm font-medium">
          Today's Queue (drag to calendar)
        </div>
        <div className="flex-1 overflow-auto py-1">
          {sampleTasks.map((task) => (
            <div
              key={task.id}
              data-task-id={task.id}
              data-task-title={task.title}
              {...(task.estimatedMinutes != null
                ? {
                    'data-estimated-minutes': String(task.estimatedMinutes),
                  }
                : {})}
              className="cursor-grab rounded-lg px-3 py-2 text-sm hover:bg-secondary/50 active:cursor-grabbing"
            >
              {task.title}
              {task.estimatedMinutes && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {task.estimatedMinutes}m
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Event log */}
        <div className="border-t border-border p-2">
          <div className="mb-1 text-xs font-medium text-muted-foreground">
            Event log:
          </div>
          <div className="max-h-32 overflow-auto">
            {log.length === 0 ? (
              <div className="text-xs text-muted-foreground/50">
                Drag events to see logs
              </div>
            ) : (
              log.map((entry, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="flex-1">
        <CalendarView
          events={events}
          dndCallbacks={dndCallbacks}
          externalDragContainerRef={taskListRef}
        />
      </div>
    </div>
  )
}

const meta = {
  title: 'Calendar/CalendarDnd',
  component: DndCalendarDemo,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DndCalendarDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Interactive: Story = {}

export const WithExternalDrag: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Drag tasks from the left panel onto the calendar to create new time blocks. Existing blocks can be moved and resized.',
      },
    },
  },
}
