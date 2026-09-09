import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { TimeBlockPreviewCard } from '#components/task/time-block-preview-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { StoryRouter } from '#storybook-config/story-router'

function TimeBlockPreviewCardWithProviders({
  task,
  block,
  onDelete,
  isDeleting,
}: {
  task: TaskPreviewChipTask | null
  block: Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>
  onDelete: () => void
  isDeleting?: boolean | undefined
}) {
  return (
    <StoryRouter
      component={() => (
        <TimeBlockPreviewCard
          task={task}
          block={block}
          onDelete={onDelete}
          isDeleting={isDeleting}
        />
      )}
      paths={['/tasks/$taskId']}
    />
  )
}

const meta = {
  title: 'Task/TimeBlockPreviewCard',
  component: TimeBlockPreviewCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TimeBlockPreviewCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

const task = makeTask({ number: 12, title: 'Write onboarding doc' })

export const Manual: Story = {
  args: {
    task,
    block: makeTimeBlock(),
    onDelete: () => {},
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(task.title)).toBeVisible()
    await expect(canvas.getByText('manual')).toBeVisible()
  },
}

export const Auto: Story = {
  args: {
    task,
    block: makeTimeBlock({ isAutoScheduled: true }),
    onDelete: () => {},
  },
}

// The task fetch hasn't resolved yet: the calendar gates it behind the
// hover-card's open state, so there's a brief window with no task info.
export const Loading: Story = {
  args: {
    task: null,
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Deleting: Story = {
  args: {
    task,
    block: makeTimeBlock(),
    onDelete: () => {},
    isDeleting: true,
  },
}

export const DeleteConfirmed: Story = {
  args: {
    task,
    block: makeTimeBlock(),
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      body.getByRole('button', { name: 'Delete time block' }),
    )
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await expect(args.onDelete).toHaveBeenCalled()
  },
}
