import type { Meta, StoryObj } from '@storybook/react-vite'

import { Input } from '#components/ui/input'

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows an empty task title input',
  args: {
    placeholder: 'Task title',
  },
}

export const WithValue: Story = {
  name: 'shows a task title input with existing text',
  args: {
    defaultValue: 'Write the quarterly report',
  },
}

export const Disabled: Story = {
  name: 'shows a disabled task title input',
  args: {
    placeholder: 'Task title',
    disabled: true,
  },
}

export const Placeholder: Story = {
  name: 'shows an empty schedule title input',
  args: {
    placeholder: 'Schedule title',
  },
}

export const DurationInput: Story = {
  name: 'shows an empty duration input with an example format',
  args: {
    placeholder: '1h30m',
  },
}

export const DateInput: Story = {
  name: 'shows an empty date input',
  args: {
    type: 'date',
  },
}
