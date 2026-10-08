import type { QueueSectionData } from '#components/day-view/queue-pane'
import {
  DAY_QUEUE_KEY,
  type Queue,
  type QueueItem,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import {
  formatLocalDate,
  formatShortDate,
  formatWeekRangeLabel,
  getLocalWeekDateRange,
} from '#lib/date-range'
import { sortQueueTasksByDue } from '#lib/queue-task-due-order'
import { sortQueueItemsBySortOrder } from '#lib/queue-task-order'

export const DUE_TODAY_SECTION_KEY = 'due-today'

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

function dayGroupLabel(date: string): string {
  const localDate = new Date(`${date}T00:00:00`)
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
  }).format(localDate)
  return `${weekday} ${formatShortDate(localDate)}`
}

function buildFutureDayGroups(
  dayQueueItems: readonly { date: string; item: QueueItem }[],
  selectedDate: Date,
  taskMap: ReadonlyMap<string, Task>,
  weekTaskIds: ReadonlySet<string>,
): NonNullable<QueueSectionData['dayGroups']> {
  const selectedDateString = formatLocalDate(selectedDate)
  const { endDate } = getLocalWeekDateRange(selectedDate)
  const itemsByDate = new Map<string, QueueItem[]>()

  for (const { date, item } of dayQueueItems) {
    if (date <= selectedDateString || date > endDate) continue
    const items = itemsByDate.get(date) ?? []
    items.push(item)
    itemsByDate.set(date, items)
  }

  return [...itemsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => {
      const tasks = sortQueueItemsBySortOrder(items)
        .map((item) => taskMap.get(item.taskId))
        .filter(
          (task): task is Task =>
            task != null &&
            task.status !== 'completed' &&
            !weekTaskIds.has(task.id),
        )

      return {
        date,
        label: dayGroupLabel(date),
        items: sortQueueTasksByDue(tasks),
      }
    })
    .filter((group) => group.items.length > 0)
}

export function buildQueueSections(
  queues: Queue[] | undefined,
  rawItemsByKey: ReadonlyMap<string, QueueItem[]>,
  taskMap: ReadonlyMap<string, Task>,
  selectedDate: Date,
  dayQueueItems?: readonly { date: string; item: QueueItem }[],
): QueueSectionData[] {
  return (queues ?? []).map((queue) => {
    const rawTasks = sortQueueItemsBySortOrder(
      rawItemsByKey.get(queue.key) ?? [],
    )
      .map((item) => taskMap.get(item.taskId))
      .filter((t): t is Task => t != null)
    const visibleTasks =
      queue.key === DAY_QUEUE_KEY
        ? rawTasks
        : rawTasks.filter((t) => t.status !== 'completed')
    const orderedTasks =
      queue.periodUnit == null
        ? visibleTasks
        : sortQueueTasksByDue(visibleTasks)
    const dateRangeLabel = dateRangeLabelFor(queue.periodUnit, selectedDate)
    const weekTaskIds = new Set(visibleTasks.map((task) => task.id))
    const dayGroups =
      queue.key === WEEK_QUEUE_KEY && dayQueueItems != null
        ? buildFutureDayGroups(
            dayQueueItems,
            selectedDate,
            taskMap,
            weekTaskIds,
          )
        : undefined
    return {
      key: queue.key,
      title: queue.name,
      items: orderedTasks,
      ...(dayGroups == null ? {} : { dayGroups }),
      ...(dateRangeLabel != null ? { dateRangeLabel } : {}),
      emptyMessage: `No tasks in ${queue.name}'s queue`,
    }
  })
}

export function buildCompactQueueSections(
  queueSections: QueueSectionData[],
  tasksDueOnOrBeforeToday: Task[],
): QueueSectionData[] {
  const dueTaskIds = new Set(tasksDueOnOrBeforeToday.map((task) => task.id))
  const daySection = queueSections.find(
    (section) => section.key === DAY_QUEUE_KEY,
  )

  return [
    {
      key: DUE_TODAY_SECTION_KEY,
      title: 'due today',
      items: tasksDueOnOrBeforeToday,
      emptyMessage: 'No tasks due today',
      isReadOnly: true,
    },
    ...(daySection == null
      ? []
      : [
          {
            ...daySection,
            items: daySection.items.filter((task) => !dueTaskIds.has(task.id)),
          },
        ]),
  ]
}

export function findWritableQueueSection(
  sections: QueueSectionData[],
  overId: string,
): QueueSectionData | undefined {
  const section =
    sections.find((candidate) => candidate.key === overId) ??
    sections.find((candidate) =>
      candidate.items.some((task) => task.id === overId),
    )

  return section?.isReadOnly === true ? undefined : section
}
