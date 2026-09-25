import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { Chip } from '#components/ui/chip'

const meta = {
  title: 'UI/Chip',
  component: Chip,
  tags: ['autodocs'],
  argTypes: {
    as: {
      control: 'select',
      options: ['span', 'button'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md'],
    },
  },
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Context: Story = {
  name: 'shows a context chip labeled work',
  args: {
    children: 'work',
  },
}

export const GhLink: Story = {
  name: 'shows a GitHub task reference chip',
  args: {
    children: 'tq#212',
  },
}

export const TagActive: Story = {
  name: 'shows the active dev:tq label chip',
  args: {
    size: 'md',
    active: true,
    children: (
      <>
        <span className="text-primary font-bold">#</span>
        dev:tq
      </>
    ),
  },
}

export const StatusBadge: Story = {
  name: 'shows a chip for active status',
  args: {
    size: 'md',
    children: 'active',
  },
}

export const Interactive: Story = {
  name: 'shows a clickable filter chip',
  args: {
    as: 'button',
    size: 'md',
    children: 'filter',
    onClick: fn(),
  },
}

export const AllVariants: Story = {
  name: 'compares context, task, tag, status, and filter chips',
  args: {
    children: 'work',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Chip>work</Chip>
      <Chip>tq#212</Chip>
      <Chip size="md" active>
        <span className="text-primary font-bold">#</span>
        dev:tq
      </Chip>
      <Chip size="md">active</Chip>
      <Chip as="button" size="md">
        filter
      </Chip>
    </div>
  ),
}
