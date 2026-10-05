import { Button } from '@fohte/ui/button'
import { SegmentedControl } from '@fohte/ui/segmented-control'

import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'

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
      <div className="ml-2.5">
        <SegmentedControl
          value={filter}
          options={[
            { value: 'active', label: 'active' },
            { value: 'all', label: 'all' },
          ]}
          onValueChange={onFilterChange}
        />
      </div>
      <Button size="xs" className="ml-auto text-2xs" onClick={onCreate}>
        + new
      </Button>
    </ScreenHeaderBar>
  )
}
