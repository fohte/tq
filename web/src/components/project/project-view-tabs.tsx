import { cn } from '@web/lib/utils'

export type ProjectView = 'list' | 'gantt'

const VIEW_OPTIONS: Array<{ value: ProjectView; label: string }> = [
  { value: 'list', label: 'List' },
  { value: 'gantt', label: 'Gantt' },
]

export function ProjectViewTabs({
  view,
  onViewChange,
}: {
  view: ProjectView
  onViewChange: (view: ProjectView) => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5">
      {VIEW_OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => {
            onViewChange(value)
          }}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition-colors',
            view === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
