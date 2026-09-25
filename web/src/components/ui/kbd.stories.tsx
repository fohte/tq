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
  name: 'shows a single keycap for the N key',
  args: {
    children: 'N',
  },
}

export const Group: Story = {
  name: 'shows the command and K keys as a shortcut',
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>K</Kbd>
    </KbdGroup>
  ),
}

export const InSentence: Story = {
  name: 'shows the command palette shortcut beside its label',
  render: () => (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span>Open command palette</span>
      <Kbd>⌘K</Kbd>
    </div>
  ),
}
