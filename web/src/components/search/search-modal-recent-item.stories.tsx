import type { Meta, StoryObj } from '@storybook/react-vite'

import { SearchModalRecentItem } from '#components/search/search-modal-recent-item'
import {
  makeRecentProject,
  makeRecentTask,
} from '#components/search/search-test-fixtures'

const task = makeRecentTask({ title: 'Prepare the weekly review' })
const project = makeRecentProject({ title: 'Website refresh' })

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
