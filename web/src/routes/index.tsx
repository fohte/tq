import { createFileRoute } from '@tanstack/react-router'
import type { CalendarDndCallbacks } from '@web/components/calendar/calendar-grid'
import type { TimeBlockEvent } from '@web/components/calendar/calendar-view'
import { DayViewPresentation } from '@web/components/day-view/day-view'
import type { Task } from '@web/hooks/use-tasks'
import { useTaskList } from '@web/hooks/use-tasks'
import {
  useCreateTimeBlock,
  useTimeBlocks,
  useUpdateTimeBlock,
} from '@web/hooks/use-time-blocks'
import { formatMinutes } from '@web/lib/format'
import { useMemo } from 'react'

export const Route = createFileRoute('/')({
  component: DayView,
})

function DayView() {
  const { isLoading, categorized } = useTaskList()

  const todayStr = useMemo(() => {
    const now = new Date()
    return `${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }, [])
  const { data: timeBlocksData } = useTimeBlocks(todayStr)
  const updateTimeBlock = useUpdateTimeBlock()
  const createTimeBlock = useCreateTimeBlock()

  const taskMap = useMemo(() => {
    const map = new Map<string, Task>()
    for (const task of categorized.all) {
      map.set(task.id, task)
    }
    return map
  }, [categorized.all])

  const calendarEvents: TimeBlockEvent[] = useMemo(() => {
    if (!timeBlocksData) return []
    return timeBlocksData
      .filter(
        (block): block is typeof block & { endTime: string } =>
          block.endTime !== null,
      )
      .map((block) => {
        const task = taskMap.get(block.taskId)
        const durationMs =
          new Date(block.endTime).getTime() -
          new Date(block.startTime).getTime()
        const durationMinutes = Math.round(durationMs / 60000)
        const durationStr = formatMinutes(durationMinutes)

        return {
          id: block.id,
          title: task?.title ?? 'Unknown task',
          start: block.startTime,
          end: block.endTime,
          type: (task?.status === 'completed'
            ? 'completed'
            : block.isAutoScheduled
              ? 'auto'
              : 'manual') as TimeBlockEvent['type'],
          duration: durationStr,
        }
      })
  }, [timeBlocksData, taskMap])

  const dndCallbacks: CalendarDndCallbacks = useMemo(
    () => ({
      onEventDrop: ({ eventId, newStart, newEnd, revert }) => {
        updateTimeBlock.mutate(
          {
            id: eventId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          },
          {
            onError: () => {
              revert()
            },
          },
        )
      },
      onEventResize: ({ eventId, newStart, newEnd, revert }) => {
        updateTimeBlock.mutate(
          {
            id: eventId,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
          },
          {
            onError: () => {
              revert()
            },
          },
        )
      },
      onExternalDrop: ({ taskId, start, end }) => {
        createTimeBlock.mutate({
          taskId,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        })
      },
    }),
    [updateTimeBlock, createTimeBlock],
  )

  return (
    <DayViewPresentation
      isLoading={isLoading}
      categorized={categorized}
      calendarEvents={calendarEvents}
      dndCallbacks={dndCallbacks}
    />
  )
}
