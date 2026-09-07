import { CheckIcon } from 'lucide-react'

import { cn } from '#lib/utils'

// A single row in a single-select list inside a filter menu (e.g. "pick a
// project" or "pick a label"): full-width, shows a checkmark when selected.
export function FilterOptionButton({
  active,
  depth = 0,
  onClick,
  children,
}: {
  active: boolean
  depth?: number
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: `${String(4 + depth * 16)}px` }}
      className={cn(
        'flex min-h-9 w-full items-center justify-between gap-2 border-t border-border pr-1 text-left text-sm first:border-t-0',
        active ? 'text-foreground' : 'text-muted-foreground',
      )}
    >
      {children}
      {active && <CheckIcon className="size-4" />}
    </button>
  )
}
