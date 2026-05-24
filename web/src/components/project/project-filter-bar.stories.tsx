import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ProjectFilterBar,
  type SortOption,
  type StatusFilter,
} from '@web/components/project/project-filter-bar'
import { useState } from 'react'

function InteractiveFilterBar({
  initialFilter = 'all',
  initialSort = 'manual',
}: {
  initialFilter?: StatusFilter
  initialSort?: SortOption
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter)
  const [sortOption, setSortOption] = useState<SortOption>(initialSort)

  return (
    <ProjectFilterBar
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      sortOption={sortOption}
      onSortOptionChange={setSortOption}
      onAddTask={() => {
        alert('Add task clicked')
      }}
    />
  )
}

const meta = {
  title: 'Project/ProjectFilterBar',
  component: InteractiveFilterBar,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-[600px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InteractiveFilterBar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const TodoSelected: Story = {
  args: { initialFilter: 'todo' },
}

export const SortByDue: Story = {
  args: { initialSort: 'due' },
}
