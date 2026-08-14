import { Button } from '#components/ui/button'
import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'

export type ProjectFilterTab = 'active' | 'all'

interface ProjectListToolbarProps {
  filter: ProjectFilterTab
  onFilterChange: (filter: ProjectFilterTab) => void
  onCreate: () => void
}

export function ProjectListToolbar({
  filter,
  onFilterChange,
  onCreate,
}: ProjectListToolbarProps) {
  return (
    <ScreenHeaderBar>
      <SectionHeading level={2}>projects</SectionHeading>
      <TabStrip
        value={filter}
        options={[
          { value: 'active', label: 'active' },
          { value: 'all', label: 'all' },
        ]}
        onChange={onFilterChange}
        className="ml-2.5"
      />
      <Button size="xs" className="ml-auto text-2xs" onClick={onCreate}>
        + new
      </Button>
    </ScreenHeaderBar>
  )
}
