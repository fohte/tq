import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ViewModeToggle } from '#components/layout/view-mode-toggle'

const meta = {
  title: 'Layout/ViewModeToggle',
  component: ViewModeToggle,
  parameters: {
    layout: 'centered',
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof ViewModeToggle>

export default meta
type Story = StoryObj<typeof meta>

export const Queue: Story = {
  args: {
    value: 'queue',
  },
}

export const Kanban: Story = {
  args: {
    value: 'kanban',
  },
}
