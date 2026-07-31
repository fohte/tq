import type { Meta, StoryObj } from '@storybook/react-vite'

import { Kbd, KbdGroup } from '#components/ui/kbd'

const meta = {
  title: 'UI/Kbd',
  component: Kbd,
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: 'N',
  },
}

export const Group: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
}

export const InSentence: Story = {
  render: () => (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span>Open command palette</span>
      <Kbd>⌘K</Kbd>
    </div>
  ),
}
