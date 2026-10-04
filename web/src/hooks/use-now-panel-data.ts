import { useEffect, useMemo, useState } from 'react'

import type { NowPanelProps } from '#components/day-view/now-panel'
import {
  buildNowPanelModel,
  buildNowPanelTaskRowStates,
  type NowPanelTaskRowState,
} from '#components/day-view/now-panel-model'
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
  taskRowStates: Map<string, NowPanelTaskRowState>
  gcalAuthRequired: boolean
}

export function useNowPanelData({
  enabled,
  context,
  taskMap,
  isTasksLoading,
  refetchInterval,
}: UseNowPanelDataOptions): NowPanelData {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!enabled) return

    const intervalId = window.setInterval(() => {
      setNow(new Date())
    }, 60_000)
    return () => {
      window.clearInterval(intervalId)
    }
  }, [enabled])

  const dateRange = getNowPanelQueryDateRange(now)
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

  useCompactRefreshErrorLogging(enabled, 'Now panel', {
    timeBlocks: timeBlocksQuery.error,
    schedules: schedulesQuery.error,
  })

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

  const timeBlocks = timeBlocksQuery.data ?? []
  const model = useMemo(
    () =>
      buildNowPanelModel({
        now,
        timeBlocks,
        calendarEvents,
        tasks: taskMap,
      }),
    [now, timeBlocks, calendarEvents, taskMap],
  )
  const taskRowStates = useMemo(
    () => buildNowPanelTaskRowStates({ now, timeBlocks, model }),
    [now, timeBlocks, model],
  )

  return {
    nowPanelProps: {
      timeBlocks,
      calendarEvents,
      taskMap,
      now,
      model,
      isLoading:
        isTasksLoading ||
        timeBlocksQuery.isPending ||
        schedulesQuery.isPending ||
        gcalEventsQuery.isPending,
    },
    taskRowStates,
    gcalAuthRequired:
      enabled && gcalEventsQuery.error instanceof GcalAuthRequiredError,
  }
}
