import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { SegmentedControl } from '#components/ui/segmented-control'

type Scale = 'day' | 'week' | 'month'

function SegmentedControlDemo({
  value,
  onChange,
}: {
  value: Scale
  onChange: (value: Scale) => void
}) {
  return (
    <SegmentedControl
      value={value}
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      onChange={onChange}
      activeClassName="bg-primary text-primary-foreground"
      inactiveClassName="text-muted-foreground hover:bg-secondary hover:text-foreground"
    />
  )
}

const meta = {
  title: 'UI/SegmentedControl',
  component: SegmentedControlDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof SegmentedControlDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'selects the week option among three calendar scales',
  args: {
    value: 'week',
  },
}

export const FirstOption: Story = {
  name: 'selects the day option among three calendar scales',
  args: {
    value: 'day',
  },
}

export const WithContainerBackground: Story = {
  name: 'shows the calendar scale control in a shaded container',
  render: (args) => (
    <SegmentedControl
      value={args.value}
      options={[
        { value: 'day', label: 'Day' },
        { value: 'week', label: 'Week' },
        { value: 'month', label: 'Month' },
      ]}
      onChange={args.onChange}
      containerClassName="rounded-md bg-secondary p-0.5"
      activeClassName="bg-background text-foreground shadow-sm"
      inactiveClassName="text-muted-foreground hover:text-foreground"
    />
  ),
  args: {
    value: 'week',
  },
}
