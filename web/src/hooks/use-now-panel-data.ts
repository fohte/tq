import { useEffect, useMemo } from 'react'

import type { NowPanelProps } from '#components/day-view/now-panel'
import {
  buildNowPanelModel,
  buildNowPanelTaskRowStates,
} from '#components/day-view/now-panel-model'
import type { TaskRowTimeBlockState } from '#components/task/task-row-time-block'
import { useCompactRefreshErrorLogging } from '#hooks/use-compact-refresh-error-logging'
import { useDayViewCalendarEvents } from '#hooks/use-day-view-calendar-events'
import {
  GcalAuthRequiredError,
  type GcalEvent,
  useGcalEvents,
} from '#hooks/use-gcal-events'
import { useNowPanelClock } from '#hooks/use-now-panel-clock'
import { type Schedule, useScheduleList } from '#hooks/use-schedules'
import type { Task } from '#hooks/use-tasks'
import { type TimeBlock, useTimeBlocks } from '#hooks/use-time-blocks'
import { getNowPanelQueryDateRange } from '#lib/compact-layout'

interface UseNowPanelQueriesOptions {
  enabled: boolean
  context: 'work' | 'personal'
}

interface NowPanelQueryData {
  now: Date
  context: 'work' | 'personal'
  enabled: boolean
  timeBlocksData: TimeBlock[] | undefined
  schedulesData: Schedule[] | undefined
  gcalEventsData: GcalEvent[] | undefined
  timeBlocksError: unknown
  schedulesError: unknown
  gcalError: unknown
  isPending: boolean
  gcalAuthRequired: boolean
}

interface UseNowPanelDataOptions {
  queryData: NowPanelQueryData
  taskMap: Map<string, Task>
  isTasksLoading: boolean
}

export interface NowPanelData {
  now: Date
  nowPanelProps: NowPanelProps
  taskRowStates: Map<string, TaskRowTimeBlockState>
}

export function useNowPanelQueries({
  enabled,
  context,
}: UseNowPanelQueriesOptions): NowPanelQueryData {
  const now = useNowPanelClock(enabled)
  const dateRange = getNowPanelQueryDateRange(now)
  const timeBlocksQuery = useTimeBlocks(
    dateRange.startDate,
    dateRange.endDate,
    enabled,
  )
  const schedulesQuery = useScheduleList(
    dateRange.startDate,
    dateRange.endDate,
    enabled,
  )
  const gcalEventsQuery = useGcalEvents(
    dateRange.startDate,
    dateRange.endDate,
    context,
    enabled,
  )

  return {
    now,
    context,
    enabled,
    timeBlocksData: timeBlocksQuery.data,
    schedulesData: schedulesQuery.data,
    gcalEventsData: gcalEventsQuery.data,
    timeBlocksError: timeBlocksQuery.error,
    schedulesError: schedulesQuery.error,
    gcalError: gcalEventsQuery.error,
    isPending:
      timeBlocksQuery.isPending ||
      schedulesQuery.isPending ||
      gcalEventsQuery.isPending,
    gcalAuthRequired:
      enabled && gcalEventsQuery.error instanceof GcalAuthRequiredError,
  }
}

export function useNowPanelData({
  queryData,
  taskMap,
  isTasksLoading,
}: UseNowPanelDataOptions): NowPanelData {
  const { now, context, timeBlocksData, schedulesData, gcalEventsData } =
    queryData

  useCompactRefreshErrorLogging(queryData.enabled, 'Now panel', {
    timeBlocks: queryData.timeBlocksError,
    schedules: queryData.schedulesError,
  })

  useEffect(() => {
    if (
      !queryData.enabled ||
      queryData.gcalError == null ||
      queryData.gcalError instanceof GcalAuthRequiredError
    ) {
      return
    }
    console.error(
      'Failed to fetch Google Calendar events for Now panel',
      queryData.gcalError,
    )
  }, [queryData.enabled, queryData.gcalError])

  const calendarEvents = useDayViewCalendarEvents({
    timeBlocksData,
    schedulesData,
    gcalEventsData,
    dayQueueItems: [],
    taskMap,
    context,
  })

  const timeBlocks = timeBlocksData ?? []
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
    now,
    nowPanelProps: {
      model,
      isLoading: isTasksLoading || queryData.isPending,
    },
    taskRowStates,
  }
}
