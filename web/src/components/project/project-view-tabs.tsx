import { SegmentedControl } from '@web/components/ui/segmented-control'

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
    <SegmentedControl
      value={view}
      options={VIEW_OPTIONS}
      onChange={onViewChange}
      containerClassName="rounded-md bg-secondary p-0.5"
      activeClassName="bg-background text-foreground shadow-sm"
      inactiveClassName="text-muted-foreground hover:text-foreground"
    />
  )
}
