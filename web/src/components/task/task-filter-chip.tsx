import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'

import { FilterMenu } from '#components/ui/filter-menu'
import { cn } from '#lib/utils'

interface TaskFilterChipProps {
  icon: LucideIcon
  attribute: string
  value: React.ReactNode
  menuTitle: string
  ariaLabel?: string
  className?: string
  children: React.ReactNode
  defaultOpen?: boolean
  onRemove?: (() => void) | undefined
  isDefault?: boolean
}

// The qualifier opens its filter menu; the separate remove button clears
// only this condition without opening that menu.
export function TaskFilterChip({
  icon: Icon,
  attribute,
  value,
  menuTitle,
  ariaLabel,
  className,
  children,
  defaultOpen,
  onRemove,
  isDefault = false,
}: TaskFilterChipProps) {
  return (
    <span
      className={cn(
        'inline-flex min-h-5 min-w-0 items-center gap-1',
        isDefault && 'opacity-50',
        className,
      )}
    >
      <FilterMenu
        trigger={
          <>
            <Icon
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="shrink-0 text-muted-foreground">{attribute}:</span>
            <span className="min-w-0 rounded-task-filter-value bg-task-filter-value-background px-1 text-task-filter-value-foreground">
              {value}
            </span>
          </>
        }
        triggerClassName="inline-flex h-5 min-w-0 cursor-pointer items-center gap-1 font-mono text-xs outline-none hover:opacity-80 focus-visible:underline"
        triggerAriaLabel={ariaLabel}
        title={menuTitle}
        defaultOpen={defaultOpen}
      >
        {children}
      </FilterMenu>
      {onRemove != null && (
        <button
          type="button"
          aria-label={`Remove ${menuTitle.toLowerCase()} filter`}
          onClick={onRemove}
          className="inline-flex size-4 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:outline-1 focus-visible:outline-ring"
        >
          <X className="size-3" aria-hidden="true" />
        </button>
      )}
    </span>
  )
}
