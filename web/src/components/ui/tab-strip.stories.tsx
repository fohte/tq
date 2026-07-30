import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { fn } from 'storybook/test'

import { TabStrip } from '#components/ui/tab-strip'

type TaskTab = 'today' | 'all' | 'backlog'

function TaskTabStripDemo({
  onChange,
}: {
  onChange: (value: TaskTab) => void
}) {
  const [value, setValue] = useState<TaskTab>('today')

  return (
    <TabStrip
      value={value}
      options={[
        { value: 'today', label: 'Today' },
        { value: 'all', label: 'All' },
        { value: 'backlog', label: 'Backlog' },
      ]}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

type Scale = 'day' | 'week' | 'month'

function ScaleTabStripDemo({ onChange }: { onChange: (value: Scale) => void }) {
  const [value, setValue] = useState<Scale>('week')

  return (
    <TabStrip
      value={value}
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

const meta = {
  title: 'UI/TabStrip',
  component: TaskTabStripDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof TaskTabStripDemo>

export default meta
type Story = StoryObj<typeof meta>

export const TaskTabs: Story = {}

export const ScaleTabs: Story = {
  render: () => <ScaleTabStripDemo onChange={fn()} />,
}
