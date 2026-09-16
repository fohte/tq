import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { useRemoveFromDayQueue } from '#hooks/use-queues'
import { useTask } from '#hooks/use-tasks'
import { useDeleteManualTimeBlock } from '#hooks/use-time-blocks'
import { partialMutation } from '#lib/test-utils'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      ...props
    }: {
      children: React.ReactNode
      to?: string
    } & Record<string, unknown>) => (
      <a href={typeof to === 'string' ? to : '#'} {...props}>
        {children}
      </a>
    ),
  }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return { ...original, useTask: vi.fn() }
})

vi.mock('#hooks/use-time-blocks', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-time-blocks')>()
  return { ...original, useDeleteManualTimeBlock: vi.fn() }
})

vi.mock('#hooks/use-queues', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-queues')>()
  return { ...original, useRemoveFromDayQueue: vi.fn() }
})

const mockUseTask = vi.mocked(useTask)
const mockUseDeleteManualTimeBlock = vi.mocked(useDeleteManualTimeBlock)
const mockUseRemoveFromDayQueue = vi.mocked(useRemoveFromDayQueue)

type UseTaskResult = ReturnType<typeof useTask>

const taskId = '00000000-0000-0000-0000-000000000001'

const taskFixture = makeTaskDetail({
  id: taskId,
  number: 12,
  title: 'Write onboarding doc',
})

function Chip({ label }: { label: string }) {
  return <div>{label}</div>
}

const manualEvent = {
  id: 'block-manual',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
  },
}

const autoEvent = {
  id: 'block-auto',
  start: new Date('2026-07-30T10:00:00.000Z'),
  end: new Date('2026-07-30T11:30:00.000Z'),
  extendedProps: {
    type: 'auto' as const,
    taskId,
    isAutoScheduled: true,
  },
}

const redactedEvent = {
  id: 'block-redacted',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
    redacted: true,
  },
}

describe('TimeBlockPreviewTrigger', () => {
  it('shows the task on hover for a manual block', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={manualEvent}>
        <Chip label="Manual task" />
      </TimeBlockPreviewTrigger>,
    )

    await user.hover(screen.getByText('Manual task'))

    await waitFor(() => {
      expect(screen.getByText('manual')).toBeVisible()
    })
    expect(screen.getByText(taskFixture.title)).toBeVisible()
  })

  it('calls the delete mutation when a manual block is deleted', async () => {
    const onDelete = vi.fn()
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete,
      isDeleting: false,
    })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={manualEvent} defaultOpen>
        <Chip label="Manual task" />
      </TimeBlockPreviewTrigger>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Delete time block' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
  })

  it('shows the task and queue info on hover for an auto block', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseRemoveFromDayQueue.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={autoEvent}>
        <Chip label="Auto task" />
      </TimeBlockPreviewTrigger>,
    )

    await user.hover(screen.getByText('Auto task'))

    await waitFor(() => {
      expect(screen.getByText('auto')).toBeVisible()
    })
    expect(screen.getByText(taskFixture.title)).toBeVisible()
  })

  it('calls the remove-from-queue mutation when an auto block is removed', async () => {
    const onDelete = vi.fn()
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseRemoveFromDayQueue.mockReturnValue({ onDelete, isDeleting: false })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={autoEvent} defaultOpen>
        <Chip label="Auto task" />
      </TimeBlockPreviewTrigger>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Remove from queue' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalled()
  })

  it('renders children without a popup for a redacted block', async () => {
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={redactedEvent}>
        <Chip label="Busy" />
      </TimeBlockPreviewTrigger>,
    )

    await user.hover(screen.getByText('Busy'))

    expect(screen.queryByRole('button')).toBeNull()
  })

  it('closes an open popup on pointerdown on the trigger', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={manualEvent}>
        <Chip label="Manual task" />
      </TimeBlockPreviewTrigger>,
    )

    const chip = screen.getByText('Manual task')
    await user.hover(chip)
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Delete time block' }),
      ).toBeVisible()
    })

    fireEvent.pointerDown(chip)

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Delete time block' }),
      ).toBeNull()
    })
  })
})
