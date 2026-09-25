import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from '#components/ui/input'
import { Label } from '#components/ui/label'

const meta = {
  title: 'UI/Label',
  component: Label,
  tags: ['autodocs'],
} satisfies Meta<typeof Label>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows a label for the task title field',
  args: {
    children: 'Task title',
  },
}

export const WithInput: Story = {
  name: 'shows a task title label above its input',
  render: () => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="label-story-title">Task title</Label>
      <Input id="label-story-title" placeholder="Write the quarterly report" />
    </div>
  ),
}

export const Disabled: Story = {
  name: 'shows a disabled task title field and label',
  render: () => (
    <div className="group flex flex-col gap-1.5" data-disabled="true">
      <Label htmlFor="label-story-disabled">Task title</Label>
      <Input id="label-story-disabled" className="peer" disabled />
    </div>
  ),
}
