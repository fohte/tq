import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'

import { TimeBlockCard } from '#components/task/time-block-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

const meta = {
  title: 'Task/TaskDetail/TimeBlockCard',
  component: TimeBlockCard,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TimeBlockCard>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Auto: Story = {
  args: {
    block: makeTimeBlock({ isAutoScheduled: true }),
    onDelete: () => {},
  },
}

export const Deleting: Story = {
  args: {
    block: makeTimeBlock(),
    onDelete: () => {},
    isDeleting: true,
  },
}

export const ManualDeleteConfirm: Story = {
  args: {
    block: makeTimeBlock(),
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      body.getByRole('button', { name: 'Delete time block' }),
    )

    await expect(await body.findByText('Delete time block')).toBeInTheDocument()
    await expect(
      await body.findByText(
        'Are you sure you want to delete this time block? This action cannot be undone.',
      ),
    ).toBeInTheDocument()

    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await expect(args.onDelete).toHaveBeenCalled()
  },
}

export const AutoDeleteConfirm: Story = {
  args: {
    block: makeTimeBlock({ isAutoScheduled: true }),
    onDelete: fn(),
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(
      body.getByRole('button', { name: 'Remove from queue' }),
    )

    await expect(await body.findByText('Remove from queue')).toBeInTheDocument()
    await expect(
      await body.findByText(
        "This task will be removed from that day's queue and won't be auto-scheduled again unless you re-add it.",
      ),
    ).toBeInTheDocument()

    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await expect(args.onDelete).toHaveBeenCalled()
  },
}
