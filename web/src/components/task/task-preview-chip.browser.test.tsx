import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskMentionChip } from '#components/task/task-mention-chip'
import { TaskPreviewChip } from '#components/task/task-preview-chip'
import {
  makeTask,
  makeTaskDetail,
} from '#components/task/task-row-test-fixtures'
import { TaskUrlChip } from '#components/task/task-url-chip'
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import { useTaskUrlPreview } from '#hooks/use-task-url-preview'
import { partialMutation } from '#lib/test-utils'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  }
})

vi.mock('#hooks/use-task-mentions', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-task-mentions')>()
  return {
    ...original,
    useTaskMentionPreview: vi.fn(),
  }
})

vi.mock('#hooks/use-task-url-preview', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-task-url-preview')>()
  return {
    ...original,
    useTaskUrlPreview: vi.fn(),
  }
})

const mockUseTaskMentionPreview = vi.mocked(useTaskMentionPreview)
const mockUseTaskUrlPreview = vi.mocked(useTaskUrlPreview)

async function hoverOverChip(title: string) {
  const user = userEvent.setup()
  await user.hover(screen.getByText(title))
}

describe('TaskPreviewChip', () => {
  it('opens the popup and shows the description on hover', async () => {
    const task = makeTask({
      number: 42,
      title: 'Implement task URL live preview',
      description: 'Adds live preview chips for a resolved task reference.',
    })
    render(<TaskPreviewChip task={task} raw={`#${String(task.number)}`} />)

    await hoverOverChip(task.title)

    await waitFor(() =>
      expect(
        within(document.body).getByText(task.description ?? ''),
      ).toBeVisible(),
    )
  })
})

describe('TaskMentionChip', () => {
  it('shows the resolved task on hover', async () => {
    const task = makeTaskDetail({
      number: 42,
      title: 'Implement task mention live preview',
      description: 'Adds live preview chips for #123-style task mentions.',
    })
    mockUseTaskMentionPreview.mockReturnValue(
      partialMutation<ReturnType<typeof useTaskMentionPreview>>({
        data: task,
      }),
    )
    render(
      <TaskMentionChip
        data={{ number: task.number }}
        raw={`#${String(task.number)}`}
      />,
    )

    await hoverOverChip(task.title)

    await waitFor(() =>
      expect(
        within(document.body).getByText(task.description ?? ''),
      ).toBeVisible(),
    )
  })
})

describe('TaskUrlChip', () => {
  it('shows the resolved task on hover', async () => {
    const task = makeTaskDetail({
      number: 42,
      title: 'Implement task URL live preview',
      description: 'Adds live preview chips for pasted tq task URLs.',
    })
    mockUseTaskUrlPreview.mockReturnValue(
      partialMutation<ReturnType<typeof useTaskUrlPreview>>({ data: task }),
    )
    render(
      <TaskUrlChip
        data={{ id: String(task.number) }}
        raw={`https://tq.fohte.net/tasks/${String(task.number)}`}
      />,
    )

    await hoverOverChip(task.title)

    await waitFor(() =>
      expect(
        within(document.body).getByText(task.description ?? ''),
      ).toBeVisible(),
    )
  })
})
