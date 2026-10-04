import type { QueueSectionData } from '#components/day-view/queue-pane'
import { DAY_QUEUE_KEY, type Queue, type QueueItem } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import { formatShortDate, formatWeekRangeLabel } from '#lib/date-range'

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

export function filterTasksDueOnOrBeforeToday(
  tasks: Task[],
  today: string,
): Task[] {
  return tasks.filter((task) => task.dueDate != null && task.dueDate <= today)
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
