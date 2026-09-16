import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { FilterOptionButton } from '#components/ui/filter-option-button'

const meta = {
  title: 'UI/FilterOptionButton',
  component: FilterOptionButton,
  args: {
    active: false,
    onClick: fn(),
    children: 'All projects',
  },
} satisfies Meta<typeof FilterOptionButton>

export default meta
type Story = StoryObj<typeof meta>

export const Inactive: Story = {}

export const Active: Story = {
  args: {
    active: true,
  },
}

export const Indented: Story = {
  args: {
    depth: 1,
    children: 'tq',
  },
}
