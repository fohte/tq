import type { Meta, StoryObj } from '@storybook/react-vite'
import { ArrowDownWideNarrow, CircleDot, Tag } from 'lucide-react'

import { TaskFilterChip } from '#components/task/task-filter-chip'

const meta = {
  title: 'Task/TaskFilterChip',
  component: TaskFilterChip,
  args: {
    icon: CircleDot,
    attribute: 'is',
    value: 'todo, doing',
    menuTitle: 'Status',
    children: <div className="text-sm text-foreground">menu content</div>,
  },
} satisfies Meta<typeof TaskFilterChip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the chip displays a status filter',
  args: { onRemove: () => undefined },
}

export const LabelChip: Story = {
  name: 'the chip displays a label filter',
  args: {
    icon: Tag,
    attribute: 'label',
    value: 'infra',
    menuTitle: 'Label',
    onRemove: () => undefined,
  },
}

export const DefaultSort: Story = {
  name: 'the default sort filter is muted without a remove button',
  args: {
    icon: ArrowDownWideNarrow,
    attribute: 'sort',
    value: 'updated',
    menuTitle: 'Sort',
    isDefault: true,
    onRemove: undefined,
  },
}

export const OpenMenu: Story = {
  name: 'the filter chip menu is open',
  tags: ['desktop-only'],
  args: {
    defaultOpen: true,
  },
}
