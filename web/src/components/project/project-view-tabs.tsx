import { TabStrip } from '#components/ui/tab-strip'

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
    <TabStrip value={view} options={VIEW_OPTIONS} onChange={onViewChange} />
  )
}
