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
  name: 'shows an empty progress indicator',
  args: {
    value: 0,
  },
}

export const Half: Story = {
  name: 'shows a progress indicator that is halfway complete',
  args: {
    value: 50,
  },
}

export const Full: Story = {
  name: 'shows a completed progress indicator',
  args: {
    value: 100,
  },
}

export const WithLabelAndValue: Story = {
  name: 'shows focus queue progress with its completed count',
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
