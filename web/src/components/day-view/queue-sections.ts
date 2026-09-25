import type { QueueSectionData } from '#components/day-view/queue-pane'
import { DAY_QUEUE_KEY, type Queue, type QueueItem } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import { formatShortDate, formatWeekRangeLabel } from '#lib/date-range'

function dateRangeLabelFor(
  periodUnit: Queue['periodUnit'],
  date: Date,
): string | undefined {
  switch (periodUnit) {
    case 'day':
      return formatShortDate(date)
    case 'week':
      return formatWeekRangeLabel(date)
    default:
      return undefined
  }
}

export function buildQueueSections(
  queues: Queue[] | undefined,
  rawItemsByKey: ReadonlyMap<string, QueueItem[]>,
  taskMap: ReadonlyMap<string, Task>,
  selectedDate: Date,
): QueueSectionData[] {
  return (queues ?? []).map((queue) => {
    const rawTasks = (rawItemsByKey.get(queue.key) ?? [])
      .map((item) => taskMap.get(item.taskId))
      .filter((t): t is Task => t != null)
    const visibleTasks =
      queue.key === DAY_QUEUE_KEY
        ? rawTasks
        : rawTasks.filter((t) => t.status !== 'completed')
    const dateRangeLabel = dateRangeLabelFor(queue.periodUnit, selectedDate)

    return {
      key: queue.key,
      title: queue.name,
      items: visibleTasks,
      ...(dateRangeLabel != null ? { dateRangeLabel } : {}),
      emptyMessage: `No tasks in ${queue.name}'s queue`,
    }
  })
}
