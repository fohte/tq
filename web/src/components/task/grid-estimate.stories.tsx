import type { Meta, StoryObj } from '@storybook/react-vite'

import { GridEstimate } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/GridEstimate',
  component: GridEstimate,
  tags: ['autodocs'],
} satisfies Meta<typeof GridEstimate>

export default meta
type Story = StoryObj<typeof meta>

export const MinutesOnly: Story = {
  args: {
    estimatedMinutes: 30,
    isCompleted: false,
  },
}

export const HoursAndMinutes: Story = {
  args: {
    estimatedMinutes: 150,
    isCompleted: false,
  },
}

export const CompletedTask: Story = {
  args: {
    estimatedMinutes: 30,
    isCompleted: true,
  },
}

export const AllVariants: Story = {
  args: {
    estimatedMinutes: 30,
    isCompleted: false,
  },
  render: () => (
    <div className="flex items-center gap-4">
      <GridEstimate estimatedMinutes={30} isCompleted={false} />
      <GridEstimate estimatedMinutes={150} isCompleted={false} />
      <GridEstimate estimatedMinutes={30} isCompleted={true} />
    </div>
  ),
}
