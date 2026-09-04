import { useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'

import { KeybindHint } from '#components/ui/keybind-hint'
import { useFilteredTaskList } from '#hooks/use-filtered-tasks'
import { DAY_QUEUE_KEY, useQueueItems } from '#hooks/use-queues'
import { useTaskMap } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { formatMinutes } from '#lib/format'
import {
  navKeybindings,
  newTaskKeybinding,
  searchKeybinding,
} from '#lib/keybindings'

const shortcuts = [
  { key: searchKeybinding.keys, label: 'search' },
  { key: newTaskKeybinding.keys, label: 'new' },
  { key: navKeybindings.goToTasks.keys, label: 'goto' },
]

export function StatusLine() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { all, isLoading: isTaskListLoading } = useFilteredTaskList()

  const taskMap = useTaskMap(all)
  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useQueueItems(DAY_QUEUE_KEY, todayStr)
  const isLoading = isTaskListLoading || isTodayTasksLoading

  const queueTasks = useMemo(
    () =>
      (todayTasksData ?? [])
        .map((t) => taskMap.get(t.taskId))
        .filter((t) => t != null),
    [todayTasksData, taskMap],
  )
  const remainingEstimate = queueTasks.reduce(
    (total, t) =>
      t.status === 'completed' ? total : total + (t.estimatedMinutes ?? 0),
    0,
  )

  return (
    <div className="sticky bottom-0 hidden h-6 shrink-0 items-center gap-3 border-t border-border bg-card px-3 font-mono text-2xs text-muted-foreground-faint md:flex">
      <span>
        <span className="text-primary">&gt;</span>{' '}
        <span className="text-muted-foreground-strong">{pathname}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        {isLoading
          ? '…'
          : `${String(all.length)} tasks · ${String(queueTasks.length)} queued · ${formatMinutes(remainingEstimate)} left`}
      </span>
      <div className="ml-auto flex gap-3.5 whitespace-nowrap">
        {shortcuts.map((shortcut) => (
          <span key={shortcut.label}>
            <KeybindHint className="text-muted-foreground-strong">
              {shortcut.key}
            </KeybindHint>{' '}
            {shortcut.label}
          </span>
        ))}
      </div>
    </div>
  )
}
