import type { Meta, StoryObj } from '@storybook/react-vite'
import { SegmentedControl } from '@web/components/ui/segmented-control'
import { fn } from 'storybook/test'

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
  args: {
    value: 'week',
  },
}

export const FirstOption: Story = {
  args: {
    value: 'day',
  },
}

export const WithContainerBackground: Story = {
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
