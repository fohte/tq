import type { Meta, StoryObj } from '@storybook/react-vite'

import { Separator } from '#components/ui/separator'

const meta = {
  title: 'UI/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium">tq</h4>
        <p className="text-sm text-muted-foreground">
          A terminal-first task manager.
        </p>
      </div>
      <Separator />
      <div className="space-y-1">
        <h4 className="text-sm font-medium">Tasks</h4>
        <p className="text-sm text-muted-foreground">
          Organize and track your work.
        </p>
      </div>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center gap-4 text-sm">
      <span>Blog</span>
      <Separator orientation="vertical" />
      <span>Docs</span>
      <Separator orientation="vertical" />
      <span>Source</span>
    </div>
  ),
}
