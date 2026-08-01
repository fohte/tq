import { useRouterState } from '@tanstack/react-router'

import { KeybindHint } from '#components/ui/keybind-hint'
import { useFilteredTaskList } from '#hooks/use-filtered-tasks'

const shortcuts = [
  { key: '⌘K', label: 'search' },
  { key: 'n', label: 'new' },
  { key: 'g t', label: 'goto' },
] as const

export function StatusLine() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const { nonBacklog, today, isLoading } = useFilteredTaskList()

  return (
    <div className="hidden h-6 shrink-0 items-center gap-3 border-t border-border bg-card px-3 font-mono text-[10px] text-muted-foreground-faint md:flex">
      <span>
        <span className="text-primary">&gt;</span>{' '}
        <span className="text-muted-foreground-strong">{pathname}</span>
      </span>
      <span className="text-border">|</span>
      <span>
        {isLoading
          ? '…'
          : `${String(nonBacklog.length)} tasks · ${String(today.length)} open`}
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
