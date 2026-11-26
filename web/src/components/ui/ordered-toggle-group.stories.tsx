import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { OrderedToggleGroup } from '#components/ui/ordered-toggle-group'

const meta = {
  title: 'UI/OrderedToggleGroup',
  component: OrderedToggleGroup,
  parameters: {
    layout: 'centered',
  },
  args: {
    values: ['alpha'],
    options: [
      { value: 'alpha', label: 'Alpha' },
      { value: 'beta', label: 'Beta' },
      { value: 'gamma', label: 'Gamma' },
    ],
    onValuesChange: fn(),
  },
} satisfies Meta<typeof OrderedToggleGroup>

export default meta
type Story = StoryObj<typeof meta>

export const SinglePressed: Story = {
  name: 'one pressed option shows no order number',
}

export const SeveralPressed: Story = {
  name: 'pressed options show the order they were pressed in',
  args: {
    values: ['gamma', 'alpha'],
  },
}
