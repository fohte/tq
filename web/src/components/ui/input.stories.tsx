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
  args: {
    placeholder: 'Task title',
  },
}

export const WithValue: Story = {
  args: {
    defaultValue: 'Write the quarterly report',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Task title',
    disabled: true,
  },
}

export const Placeholder: Story = {
  args: {
    placeholder: 'Schedule title',
  },
}

export const DurationInput: Story = {
  args: {
    placeholder: '1h30m',
  },
}

export const DateInput: Story = {
  args: {
    type: 'date',
  },
}
