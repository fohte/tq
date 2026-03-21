import {
  type ContextFilterMode,
  useContextFilter,
} from '@web/hooks/use-context-filter'
import { cn } from '@web/lib/utils'
import type { LucideIcon } from 'lucide-react'
import { Briefcase, Globe, User } from 'lucide-react'

interface FilterOption {
  mode: ContextFilterMode
  label: string
  icon: LucideIcon
}

const filterOptions: FilterOption[] = [
  { mode: 'all', label: 'All', icon: Globe },
  { mode: 'work', label: 'Work', icon: Briefcase },
  { mode: 'personal', label: 'Personal', icon: User },
]

export function ContextFilter() {
  const { mode, setMode } = useContextFilter()

  return (
    <div className="flex flex-col items-center gap-1">
      {filterOptions.map((option) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => setMode(option.mode)}
          title={option.label}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md transition-colors',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            mode === option.mode
              ? 'bg-sidebar-accent text-primary'
              : 'text-sidebar-foreground/40',
          )}
        >
          <option.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}

/**
 * Horizontal variant for use in headers or inline contexts.
 */
export function ContextFilterInline() {
  const { mode, setMode } = useContextFilter()

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5">
      {filterOptions.map((option) => (
        <button
          key={option.mode}
          type="button"
          onClick={() => setMode(option.mode)}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            mode === option.mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <option.icon className="h-3.5 w-3.5" />
          {option.label}
        </button>
      ))}
    </div>
  )
}
