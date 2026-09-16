import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskFilterChip } from '#components/task/task-filter-chip'

const meta = {
  title: 'Task/TaskFilterChip',
  component: TaskFilterChip,
  args: {
    attribute: 'is',
    value: 'todo, doing',
    menuTitle: 'Status',
    children: <div className="text-sm text-foreground">menu content</div>,
  },
} satisfies Meta<typeof TaskFilterChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const LabelChip: Story = {
  args: {
    attribute: 'label',
    value: '#infra',
    menuTitle: 'Label',
  },
}

export const OpenMenu: Story = {
  tags: ['desktop-only'],
  args: {
    defaultOpen: true,
  },
}
