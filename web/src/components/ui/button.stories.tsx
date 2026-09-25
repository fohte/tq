import type { Meta, StoryObj } from '@storybook/react-vite'
import { CheckSquare, Plus } from 'lucide-react'

import { Button } from '#components/ui/button'

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'default',
        'outline',
        'secondary',
        'ghost',
        'destructive',
        'link',
      ],
    },
    size: {
      control: 'select',
      options: [
        'default',
        'xs',
        'sm',
        'lg',
        'icon',
        'icon-xs',
        'icon-sm',
        'icon-lg',
      ],
    },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'shows a standard button labeled Button',
  args: {
    children: 'Button',
  },
}

export const Outline: Story = {
  name: 'shows an outlined button labeled Outline',
  args: {
    variant: 'outline',
    children: 'Outline',
  },
}

export const Secondary: Story = {
  name: 'shows a secondary button labeled Secondary',
  args: {
    variant: 'secondary',
    children: 'Secondary',
  },
}

export const Ghost: Story = {
  name: 'shows a ghost button labeled Ghost',
  args: {
    variant: 'ghost',
    children: 'Ghost',
  },
}

export const Destructive: Story = {
  name: 'shows a delete button with the destructive style',
  args: {
    variant: 'destructive',
    children: 'Delete',
  },
}

export const Link: Story = {
  name: 'shows the Link label in button link styling',
  args: {
    variant: 'link',
    children: 'Link',
  },
}

export const Small: Story = {
  name: 'shows a compact button labeled Small',
  args: {
    size: 'sm',
    children: 'Small',
  },
}

export const Large: Story = {
  name: 'shows a large button labeled Large',
  args: {
    size: 'lg',
    children: 'Large',
  },
}

export const WithIcon: Story = {
  name: 'shows an add task button with a leading plus icon',
  args: {
    children: (
      <>
        <Plus data-icon="inline-start" />
        Add Task
      </>
    ),
  },
}

export const IconOnly: Story = {
  name: 'shows an icon button for the task list',
  args: {
    size: 'icon',
    children: <CheckSquare />,
    'aria-label': 'Tasks',
  },
}

export const Disabled: Story = {
  name: 'shows a disabled button labeled Disabled',
  args: {
    children: 'Disabled',
    disabled: true,
  },
}

export const AllVariants: Story = {
  name: 'compares default, outline, secondary, ghost, destructive, and link buttons',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="default">Default</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
}

export const AllSizes: Story = {
  name: 'compares extra small, small, default, large, and icon button sizes',
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs">XS</Button>
      <Button size="sm">SM</Button>
      <Button size="default">Default</Button>
      <Button size="lg">LG</Button>
      <Button size="icon">
        <Plus />
      </Button>
    </div>
  ),
}
