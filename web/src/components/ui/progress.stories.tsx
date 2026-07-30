import type { Meta, StoryObj } from '@storybook/react-vite'

import { Progress, ProgressLabel, ProgressValue } from '#components/ui/progress'

const meta = {
  title: 'UI/Progress',
  component: Progress,
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    value: 0,
  },
}

export const Half: Story = {
  args: {
    value: 50,
  },
}

export const Full: Story = {
  args: {
    value: 100,
  },
}

export const WithLabelAndValue: Story = {
  args: {
    value: 3,
    max: 8,
    children: (
      <>
        <ProgressLabel>Today&apos;s focus queue</ProgressLabel>
        <ProgressValue>{() => '3/8 completed'}</ProgressValue>
      </>
    ),
  },
}
