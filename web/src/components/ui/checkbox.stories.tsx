import type { Meta, StoryObj } from '@storybook/react-vite'

import { Checkbox } from '#components/ui/checkbox'

const meta = {
  title: 'UI/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
} satisfies Meta<typeof Checkbox>

export default meta
type Story = StoryObj<typeof meta>

export const Unchecked: Story = {
  name: 'shows an unchecked checkbox',
  args: {},
}

export const Checked: Story = {
  name: 'shows a checked checkbox',
  args: {
    defaultChecked: true,
  },
}

export const Disabled: Story = {
  name: 'shows a disabled checkbox',
  args: {
    disabled: true,
  },
}

export const DisabledChecked: Story = {
  name: 'shows a disabled checked checkbox',
  args: {
    disabled: true,
    defaultChecked: true,
  },
}
