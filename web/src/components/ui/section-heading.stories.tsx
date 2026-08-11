import type { Meta, StoryObj } from '@storybook/react-vite'

import { SectionHeading } from '#components/ui/section-heading'

const meta = {
  title: 'UI/SectionHeading',
  component: SectionHeading,
  tags: ['autodocs'],
  argTypes: {
    level: {
      control: 'select',
      options: [2, 3],
    },
  },
} satisfies Meta<typeof SectionHeading>

export default meta
type Story = StoryObj<typeof meta>

export const Level2: Story = {
  args: {
    level: 2,
    children: 'tasks',
  },
  render: (args) => (
    <div className="flex h-10 items-center gap-3 border border-border bg-card px-3">
      <SectionHeading {...args} />
      <span className="font-mono text-xs text-muted-foreground">24 open</span>
    </div>
  ),
}

export const Level3: Story = {
  args: {
    level: 3,
    children: 'subtasks',
  },
  render: (args) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <SectionHeading {...args} />
        <span className="font-mono text-xs text-muted-foreground">1/3</span>
      </div>
      <div className="h-24 border border-border bg-card" />
    </div>
  ),
}

export const AllLevels: Story = {
  args: {
    level: 2,
    children: 'tasks',
  },
  render: () => (
    <div className="flex flex-col gap-4">
      <SectionHeading level={2}>tasks</SectionHeading>
      <SectionHeading level={3}>subtasks</SectionHeading>
    </div>
  ),
}
