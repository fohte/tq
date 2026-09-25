import { FilterMenu } from '#components/ui/filter-menu'
import { cn } from '#lib/utils'

interface TaskFilterChipProps {
  attribute: React.ReactNode
  value: React.ReactNode
  menuTitle: string
  className?: 'shrink-0'
  children: React.ReactNode
  defaultOpen?: boolean
}

// An applied filter chip split into a dim attribute part and a foreground
// value part (e.g. "is  todo, doing ▾"), pressable like any other chip:
// pressing it opens a FilterMenu scoped to just that axis, so changing the
// value or removing the condition both happen in the same place instead of
// leaving the chip to re-add the condition elsewhere.
export function TaskFilterChip({
  attribute,
  value,
  menuTitle,
  className,
  children,
  defaultOpen,
}: TaskFilterChipProps) {
  return (
    <FilterMenu
      trigger={
        <>
          <span className="text-muted-foreground">{attribute}</span>{' '}
          <span>{value}</span> <span aria-hidden="true">▾</span>
        </>
      }
      triggerClassName={cn(
        'inline-flex items-center gap-1 border px-1 font-mono text-2xs border-border-strong text-foreground',
        'cursor-pointer outline-none hover:opacity-80',
        className === 'shrink-0' && 'shrink-0',
      )}
      title={menuTitle}
      defaultOpen={defaultOpen}
    >
      {children}
    </FilterMenu>
  )
}
