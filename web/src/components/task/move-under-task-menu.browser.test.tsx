import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MoveUnderTaskMenu } from '#components/task/move-under-task-menu'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...original,
    useSearchTasks: vi.fn(),
  }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useTaskList: vi.fn(),
    useUpdateTaskParent: vi.fn(),
  }
})

const mockUseSearchTasks = vi.mocked(useSearchTasks)
const mockUseTaskList = vi.mocked(useTaskList)
const mockUseUpdateTaskParent = vi.mocked(useUpdateTaskParent)

type UpdateTaskParentResult = ReturnType<typeof useUpdateTaskParent>

function mockSearchResults(data: SearchResult[]) {
  mockUseSearchTasks.mockReturnValue(
    partialMutation<ReturnType<typeof useSearchTasks>>({
      data,
      isFetching: false,
    }),
  )
}

const taskId = '00000000-0000-0000-0000-000000000001'
const taskNumber = 1

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
})

const candidateWithParent: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
})

describe('MoveUnderTaskMenu', () => {
  beforeEach(() => {
    mockUseTaskList.mockReturnValue(
      partialMutation<ReturnType<typeof useTaskList>>({
        categorized: { all: [] },
      }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UpdateTaskParentResult>({ mutate: vi.fn() }),
    )
  })

  it('shows the task number in the title and search results with a parent-task badge', async () => {
    mockSearchResults([orphanCandidate, candidateWithParent])
    const user = userEvent.setup()
    render(
      <MoveUnderTaskMenu
        open
        onOpenChange={vi.fn()}
        taskId={taskId}
        taskNumber={taskNumber}
      />,
    )

    expect(screen.getByText('Move #1 under')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.getByText('Deploy docs site')).toBeInTheDocument()
    expect(screen.getByText('← #3')).toBeInTheDocument()
  })

  it('moves the task under the selected candidate and closes the dialog', async () => {
    mockSearchResults([orphanCandidate])
    const mutate = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: this test's onSuccess callback ignores every argument, so the exact mutate signature doesn't matter here
      ((_vars: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }) as UpdateTaskParentResult['mutate'],
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UpdateTaskParentResult>({ mutate }),
    )
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <MoveUnderTaskMenu
        open
        onOpenChange={onOpenChange}
        taskId={taskId}
        taskNumber={taskNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy to production'))

    expect(mutate).toHaveBeenCalledWith(
      { id: taskId, parentId: orphanCandidate.id },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a no-results message when the search returns nothing', async () => {
    mockSearchResults([])
    const user = userEvent.setup()
    render(
      <MoveUnderTaskMenu
        open
        onOpenChange={vi.fn()}
        taskId={taskId}
        taskNumber={taskNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('no results for "Deploy"')).toBeInTheDocument()
  })

  it('excludes the task itself and its descendants from the candidate list', async () => {
    const descendant = makeTask({
      id: '00000000-0000-0000-0000-000000000021',
      number: 21,
      title: 'Deploy staging',
      parentId: taskId,
    })
    mockUseTaskList.mockReturnValue(
      partialMutation<ReturnType<typeof useTaskList>>({
        categorized: { all: [descendant] },
      }),
    )
    mockSearchResults([orphanCandidate, descendant])
    const user = userEvent.setup()
    render(
      <MoveUnderTaskMenu
        open
        onOpenChange={vi.fn()}
        taskId={taskId}
        taskNumber={taskNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.queryByText('Deploy staging')).not.toBeInTheDocument()
  })
})
