import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from 'storybook/test'

import { TagFilterBar } from '#components/tag-filter-bar'
import { TagTokens } from '#components/task/task-row-shared'

// TagTokens only reads/writes tag state via useTagFilter (no routing or
// data-fetching involved), and the Storybook preview already wraps every
// story in a TagFilterProvider, so no extra provider setup is needed here
// (see .storybook/preview.tsx and tag-filter-bar.stories.tsx for the same
// pattern).
function TagTokensDemo({
  labels,
  isCompleted,
}: {
  labels: string[]
  isCompleted: boolean
}) {
  return (
    <div className="w-80 border border-border p-3">
      <TagTokens labels={labels} isCompleted={isCompleted} />
      <TagFilterBar />
    </div>
  )
}

const meta = {
  title: 'Task/TagTokens',
  component: TagTokensDemo,
} satisfies Meta<typeof TagTokensDemo>

export default meta
type Story = StoryObj<typeof meta>

export const SingleLabel: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: false,
  },
}

export const MultipleLabels: Story = {
  args: {
    labels: ['dev:tq', 'chore', 'urgent'],
    isCompleted: false,
  },
}

export const CompletedTask: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: true,
  },
}

export const TagClick: Story = {
  args: {
    labels: ['dev:tq'],
    isCompleted: false,
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('#dev:tq'))
    await expect(canvas.getByText('filtered by')).toBeVisible()
  },
}
