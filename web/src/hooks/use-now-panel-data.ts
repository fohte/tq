import { useEffect } from 'react'

import type { NowPanelProps } from '#components/day-view/now-panel'
import { useCompactRefreshErrorLogging } from '#hooks/use-compact-refresh-error-logging'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'
import { GcalAuthRequiredError, useGcalEvents } from '#hooks/use-gcal-events'
import { useScheduleList } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import { useTimeBlocks } from '#hooks/use-time-blocks'
import { getNowPanelQueryDateRange } from '#lib/compact-layout'

interface UseNowPanelDataOptions {
  enabled: boolean
  context: 'work' | 'personal'
  taskMap: Map<string, Task>
  isTasksLoading: boolean
  refetchInterval?: number
}

export interface NowPanelData {
  nowPanelProps: NowPanelProps
  gcalAuthRequired: boolean
}

export function useNowPanelData({
  enabled,
  context,
  taskMap,
  isTasksLoading,
  refetchInterval,
}: UseNowPanelDataOptions): NowPanelData {
  const dateRange = getNowPanelQueryDateRange(new Date())
  const timeBlocksQuery = useTimeBlocks(
    dateRange.startDate,
    dateRange.endDate,
    refetchInterval,
    enabled,
  )
  const schedulesQuery = useScheduleList(
    dateRange.startDate,
    dateRange.endDate,
    refetchInterval,
    enabled,
  )
  const gcalEventsQuery = useGcalEvents(
    dateRange.startDate,
    dateRange.endDate,
    context,
    enabled,
  )

  useCompactRefreshErrorLogging(
    enabled,
    timeBlocksQuery.error,
    schedulesQuery.error,
  )

  useEffect(() => {
    if (
      !enabled ||
      gcalEventsQuery.error == null ||
      gcalEventsQuery.error instanceof GcalAuthRequiredError
    ) {
      return
    }
    console.error(
      'Failed to fetch Google Calendar events for Now panel',
      gcalEventsQuery.error,
    )
  }, [enabled, gcalEventsQuery.error])

  const calendarEvents = useDayViewCalendarEvents({
    timeBlocksData: timeBlocksQuery.data,
    schedulesData: schedulesQuery.data,
    gcalEventsData: gcalEventsQuery.data,
    taskMap,
    context,
  })

  return {
    nowPanelProps: {
      timeBlocks: timeBlocksQuery.data ?? [],
      calendarEvents,
      taskMap,
      isLoading:
        isTasksLoading ||
        timeBlocksQuery.isPending ||
        schedulesQuery.isPending ||
        gcalEventsQuery.isPending,
    },
    gcalAuthRequired:
      enabled && gcalEventsQuery.error instanceof GcalAuthRequiredError,
  }
}
