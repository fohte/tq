import type { Schedule } from '#hooks/use-schedules'

export type ScheduleEditScope = 'this' | 'following' | 'all'
export type ScheduleEditAction = 'skip' | 'restore' | 'endSeries' | null

export interface ScheduleEditDraft {
  scope: ScheduleEditScope
  occurrenceDate: string
  thisEvent: {
    date: string
    startTime: string
    endTime: string
    action: 'skip' | 'restore' | null
  }
  following: {
    fromDate: string
    startTime: string
    endTime: string
    endSeries: boolean
  }
  all: {
    startDate: string
    startTime: string
    endTime: string
  }
}

function timeOfDay(isoDateTime: string | undefined) {
  return isoDateTime?.slice(11, 16) ?? ''
}

export function createScheduleEditDraft(
  schedule: Schedule | undefined,
  defaultStartDate: string,
): ScheduleEditDraft {
  const occurrenceDate = schedule?.occurrenceDate ?? defaultStartDate
  const startTime = timeOfDay(schedule?.start)
  const endTime = timeOfDay(schedule?.end)

  return {
    scope: schedule ? 'this' : 'all',
    occurrenceDate,
    thisEvent: {
      date: schedule?.start.slice(0, 10) ?? defaultStartDate,
      startTime,
      endTime,
      action: null,
    },
    following: {
      fromDate: occurrenceDate,
      startTime,
      endTime,
      endSeries: false,
    },
    all: {
      startDate: schedule?.startDate ?? defaultStartDate,
      startTime,
      endTime,
    },
  }
}

export function currentScheduleEditAction(
  draft: ScheduleEditDraft,
): ScheduleEditAction {
  if (draft.scope === 'this') return draft.thisEvent.action
  if (draft.scope === 'following') {
    return draft.following.endSeries ? 'endSeries' : null
  }
  return null
}

export function scheduleEditStartDate(draft: ScheduleEditDraft) {
  if (draft.scope === 'this') return draft.thisEvent.date
  if (draft.scope === 'following') return draft.following.fromDate
  return draft.all.startDate
}

export function scheduleEditStartTime(draft: ScheduleEditDraft) {
  if (draft.scope === 'this') return draft.thisEvent.startTime
  if (draft.scope === 'following') return draft.following.startTime
  return draft.all.startTime
}

export function scheduleEditEndTime(draft: ScheduleEditDraft) {
  if (draft.scope === 'this') return draft.thisEvent.endTime
  if (draft.scope === 'following') return draft.following.endTime
  return draft.all.endTime
}

export function setScheduleEditStartDate(
  draft: ScheduleEditDraft,
  value: string,
): ScheduleEditDraft {
  if (draft.scope === 'this') {
    return { ...draft, thisEvent: { ...draft.thisEvent, date: value } }
  }
  if (draft.scope === 'following') {
    return { ...draft, following: { ...draft.following, fromDate: value } }
  }
  return { ...draft, all: { ...draft.all, startDate: value } }
}

export function setScheduleEditStartTime(
  draft: ScheduleEditDraft,
  value: string,
): ScheduleEditDraft {
  if (draft.scope === 'this') {
    return { ...draft, thisEvent: { ...draft.thisEvent, startTime: value } }
  }
  if (draft.scope === 'following') {
    return { ...draft, following: { ...draft.following, startTime: value } }
  }
  return { ...draft, all: { ...draft.all, startTime: value } }
}

export function setScheduleEditEndTime(
  draft: ScheduleEditDraft,
  value: string,
): ScheduleEditDraft {
  if (draft.scope === 'this') {
    return { ...draft, thisEvent: { ...draft.thisEvent, endTime: value } }
  }
  if (draft.scope === 'following') {
    return { ...draft, following: { ...draft.following, endTime: value } }
  }
  return { ...draft, all: { ...draft.all, endTime: value } }
}
