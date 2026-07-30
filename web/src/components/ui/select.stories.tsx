import type { Meta, StoryObj } from '@storybook/react-vite'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'

function SelectDemo({
  defaultValue,
  disabled,
}: {
  defaultValue?: string
  disabled?: boolean
}) {
  return (
    <Select defaultValue={defaultValue} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="todo">Todo</SelectItem>
        <SelectItem value="in_progress">In Progress</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  )
}

const meta = {
  title: 'UI/Select',
  component: SelectDemo,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SelectDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithValue: Story = {
  args: {
    defaultValue: 'in_progress',
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}
