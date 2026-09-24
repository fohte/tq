import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalRecentItem } from '#components/search/search-modal-recent-item'
import type { RecentSearchItem } from '#lib/recent-search-items'

const viewedAt = 1_800_000_000_000
const task: RecentSearchItem = {
  kind: 'task',
  id: '00000000-0000-0000-0000-000000000042',
  number: 42,
  title: 'Prepare the weekly review',
  context: 'work',
  viewedAt,
}
const project: RecentSearchItem = {
  kind: 'project',
  id: '00000000-0000-0000-0000-000000000142',
  title: 'Website refresh',
  context: 'work',
  viewedAt,
}

const meta = {
  title: 'Search/SearchModalRecentItem',
  component: SearchModalRecentItem,
  args: {
    isSelected: false,
    onMouseMove: () => undefined,
    onSelect: () => undefined,
  },
} satisfies Meta<typeof SearchModalRecentItem>

export default meta
type Story = StoryObj<typeof meta>

export const Task: Story = { args: { item: task } }

export const Project: Story = { args: { item: project } }

export const Selected: Story = { args: { item: task, isSelected: true } }
