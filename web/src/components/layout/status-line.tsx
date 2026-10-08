import { useRouterState } from '@tanstack/react-router'
import { useMemo } from 'react'

import { KeybindHint } from '#components/ui/keybind-hint'
import { useCurrentContext } from '#hooks/use-current-context'
import { DAY_QUEUE_KEY, useQueueItems } from '#hooks/use-queues'
import { useTaskCount } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import {
  navKeybindings,
  newTaskKeybinding,
  type SearchKeybinding,
} from '#lib/keybindings'

export function StatusLine({
  searchKeybinding,
}: {
  searchKeybinding: SearchKeybinding
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const context = useCurrentContext()
  const { data: todoCount, isLoading: isTodoCountLoading } = useTaskCount({
    context,
    status: 'todo',
  })
  const todayStr = useMemo(() => formatLocalDate(new Date()), [])
  const { data: todayTasksData, isLoading: isTodayTasksLoading } =
    useQueueItems(DAY_QUEUE_KEY, todayStr, { context })
  const isLoading = isTodoCountLoading || isTodayTasksLoading
  const shortcuts = [
    { key: searchKeybinding.keys, label: 'search' },
    { key: newTaskKeybinding.keys, label: 'new' },
    { key: navKeybindings.goToTasks.keys, label: 'goto' },
  ]

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
          : `${String(todoCount ?? 0)} todo · ${String(todayTasksData?.length ?? 0)} queued`}
      </span>
      <div className="ml-auto flex gap-3.5 whitespace-nowrap">
        {shortcuts.map((shortcut) => (
          <span key={shortcut.label}>
            <KeybindHint variant="strong">{shortcut.key}</KeybindHint>{' '}
            {shortcut.label}
          </span>
        ))}
      </div>
    </div>
  )
}
