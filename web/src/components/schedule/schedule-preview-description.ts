import type {
  ScheduleEditAction,
  ScheduleEditScope,
} from '#components/schedule/schedule-edit-dialog-state'
import type { ScheduleChangePreview } from '#hooks/use-schedules'

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function pluralize(count: number, singular: string) {
  return `${String(count)} ${singular}${count === 1 ? '' : 's'}`
}

export function describeSchedulePreview(
  preview: ScheduleChangePreview,
  scope: ScheduleEditScope,
  action: ScheduleEditAction,
  fromDate: string,
) {
  const { changes, deletedOverrides } = preview
  const deletedSummary =
    deletedOverrides.length === 0
      ? ''
      : ` ${pluralize(deletedOverrides.length, 'exception')} will be removed.`

  if (scope === 'this') {
    if (action === 'skip') {
      return `Skips this event on ${formatDate(fromDate)}. Other events are unchanged.`
    }
    if (action === 'restore') {
      return `Restores this event on ${formatDate(fromDate)} to its scheduled date and time.`
    }

    const change = changes[0]
    if (change?.before && change.after) {
      if (change.before.date !== change.after.date) {
        return `Moves this event from ${formatDate(change.before.date)} to ${formatDate(change.after.date)}. Other events are unchanged.`
      }
      if (
        change.before.startTime !== change.after.startTime ||
        change.before.endTime !== change.after.endTime
      ) {
        return `Changes this event on ${formatDate(change.after.date)} to ${change.after.startTime}–${change.after.endTime}. Other events are unchanged.`
      }
    }
    return `No occurrence will change.${deletedSummary}`
  }

  const changeSummary =
    changes.length === 0
      ? 'No occurrences will change.'
      : `${pluralize(changes.length, 'occurrence')} will change.`

  if (scope === 'following') {
    return `From ${formatDate(fromDate)}: ${changeSummary} Earlier events are unchanged.${deletedSummary}`
  }

  return `All events: ${changeSummary}${deletedSummary}`
}
