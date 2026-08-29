import type { Meta, StoryObj } from '@storybook/react-vite'

import { DotSeparatedList } from '#components/ui/dot-separated-list'

const meta = {
  title: 'UI/DotSeparatedList',
  component: DotSeparatedList,
  tags: ['autodocs'],
} satisfies Meta<typeof DotSeparatedList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    items: ['Design system setup', 'work', 'Mar 25'],
  },
}

export const SingleItem: Story = {
  args: {
    items: ['Design system setup'],
  },
}
