import { ScreenHeaderBar } from '#components/ui/screen-header-bar'
import { SectionHeading } from '#components/ui/section-heading'
import { TabStrip } from '#components/ui/tab-strip'

export type SessionFilterTab = 'all' | 'active'

interface SessionListToolbarProps {
  filter: SessionFilterTab
  onFilterChange: (filter: SessionFilterTab) => void
}

export function SessionListToolbar({
  filter,
  onFilterChange,
}: SessionListToolbarProps) {
  return (
    <ScreenHeaderBar>
      <SectionHeading level={2}>sessions</SectionHeading>
      <TabStrip
        value={filter}
        options={[
          { value: 'all', label: 'all' },
          { value: 'active', label: 'active' },
        ]}
        onChange={onFilterChange}
        className="ml-2.5"
      />
    </ScreenHeaderBar>
  )
}
