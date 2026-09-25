import type { Meta, StoryObj } from '@storybook/react-vite'

import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { TimeBlockPreviewCard } from '#components/task/time-block-preview-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import type { TimeBlock } from '#hooks/use-time-blocks'
import { StoryRouter } from '#storybook-config/story-router'

function TimeBlockPreviewCardWithProviders({
  task,
  isTaskError,
  block,
  onDelete,
  isDeleting,
}: {
  task: TaskPreviewChipTask | null
  isTaskError?: boolean | undefined
  block: Pick<TimeBlock, 'startTime' | 'endTime' | 'isAutoScheduled'>
  onDelete: () => void
  isDeleting?: boolean | undefined
}) {
  return (
    <StoryRouter
      component={() => (
        <TimeBlockPreviewCard
          task={task}
          isTaskError={isTaskError}
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
  name: 'a manual time block previews its linked task',
  args: {
    task,
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Auto: Story = {
  name: 'an auto-scheduled time block previews its linked task',
  args: {
    task,
    block: makeTimeBlock({ isAutoScheduled: true }),
    onDelete: () => {},
  },
}

export const Loading: Story = {
  name: 'the linked task is still loading in the preview',
  args: {
    task: null,
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Error: Story = {
  name: 'the preview shows an error loading the linked task',
  args: {
    task: null,
    isTaskError: true,
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Deleting: Story = {
  name: 'the linked task preview shows its deleting state',
  args: {
    task,
    block: makeTimeBlock(),
    onDelete: () => {},
    isDeleting: true,
  },
}
