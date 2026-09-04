import { SegmentedControl } from '#components/ui/segmented-control'

export type DayViewMode = 'queue' | 'kanban'

const OPTIONS = [
  { value: 'queue', label: 'queue' },
  { value: 'kanban', label: 'kanban' },
] as const

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: DayViewMode
  onChange: (value: DayViewMode) => void
}) {
  return (
    <SegmentedControl
      value={value}
      options={OPTIONS}
      onChange={onChange}
      containerClassName="rounded-md bg-secondary p-0.5"
      activeClassName="bg-background text-foreground shadow-sm"
      inactiveClassName="text-muted-foreground hover:text-foreground"
    />
  )
}
