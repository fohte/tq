import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import {
  autoEvent,
  manualEvent,
  redactedEvent,
  taskDateEvent,
  taskFixture,
  taskId,
} from '#components/calendar/time-block-preview-trigger-test-fixtures'
import { useTask } from '#hooks/use-tasks'
import { useDeleteTimeBlock } from '#hooks/use-time-blocks'
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
  return { ...original, useDeleteTimeBlock: vi.fn() }
})

const mockUseTask = vi.mocked(useTask)
const mockUseDeleteTimeBlock = vi.mocked(useDeleteTimeBlock)

type UseTaskResult = ReturnType<typeof useTask>

beforeEach(() => {
  mockUseTask.mockReset()
  mockUseDeleteTimeBlock.mockReset()
})

function getTaskDatePreviewOutput() {
  return {
    text: screen.getByText('Dated task').textContent,
    taskCalls: mockUseTask.mock.calls,
    deleteCalls: mockUseDeleteTimeBlock.mock.calls,
  }
}

function getDeleteOutput(deleteHookCalls: unknown, deleteCalls: number) {
  return { deleteHookCalls, deleteCalls }
}

function Chip({ label }: { label: string }) {
  return <div>{label}</div>
}

describe('TimeBlockPreviewTrigger', () => {
  it('shows the task on hover for a manual block', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteTimeBlock.mockReturnValue({
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
    mockUseDeleteTimeBlock.mockReturnValue({
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

    expect(
      getDeleteOutput(
        mockUseDeleteTimeBlock.mock.calls,
        onDelete.mock.calls.length,
      ),
    ).toEqual({
      deleteHookCalls: [[taskId, manualEvent.id]],
      deleteCalls: 1,
    })
  })

  it('shows the task on hover for an auto block', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteTimeBlock.mockReturnValue({
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

  it('deletes an auto block by its time-block id', async () => {
    const onDelete = vi.fn()
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteTimeBlock.mockReturnValue({ onDelete, isDeleting: false })
    const user = userEvent.setup()
    render(
      <TimeBlockPreviewTrigger event={autoEvent} defaultOpen>
        <Chip label="Auto task" />
      </TimeBlockPreviewTrigger>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'Delete time block' }),
    )
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      getDeleteOutput(
        mockUseDeleteTimeBlock.mock.calls,
        onDelete.mock.calls.length,
      ),
    ).toEqual({
      deleteHookCalls: [[taskId, autoEvent.id]],
      deleteCalls: 1,
    })
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

  it('renders task-date events without loading a time-block preview', () => {
    mockUseTask.mockClear()
    mockUseDeleteTimeBlock.mockClear()
    render(
      <TimeBlockPreviewTrigger event={taskDateEvent}>
        <Chip label="Dated task" />
      </TimeBlockPreviewTrigger>,
    )

    const expected = {
      text: 'Dated task',
      taskCalls: [],
      deleteCalls: [],
    }

    expect(getTaskDatePreviewOutput()).toEqual(expected)
  })

  it('closes an open popup on pointerdown on the trigger', async () => {
    mockUseTask.mockReturnValue(
      partialMutation<UseTaskResult>({ data: taskFixture, isError: false }),
    )
    mockUseDeleteTimeBlock.mockReturnValue({
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
