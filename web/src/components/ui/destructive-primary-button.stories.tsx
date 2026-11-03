import type { Meta, StoryObj } from '@storybook/react-vite'

import { DestructivePrimaryButton } from '#components/ui/destructive-primary-button'

const meta = {
  component: DestructivePrimaryButton,
  args: {
    type: 'button',
    size: 'sm',
    children: 'Complete',
  },
} satisfies Meta<typeof DestructivePrimaryButton>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  name: 'the primary destructive action is filled',
}
