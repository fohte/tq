import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LinkExistingTaskMenu } from '#components/task/link-existing-task-menu'
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

const parentId = '00000000-0000-0000-0000-000000000001'
const parentNumber = 1

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

describe('LinkExistingTaskMenu', () => {
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

  it('shows search results once a query is typed', async () => {
    mockSearchResults([orphanCandidate, candidateWithParent])
    const user = userEvent.setup()
    render(
      <LinkExistingTaskMenu
        open
        onOpenChange={vi.fn()}
        parentId={parentId}
        parentNumber={parentNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.getByText('Deploy docs site')).toBeInTheDocument()
    expect(screen.getByText('← #3')).toBeInTheDocument()
  })

  it('shows the confirm dialog when a candidate already has a parent task', async () => {
    mockSearchResults([orphanCandidate, candidateWithParent])
    const user = userEvent.setup()
    render(
      <LinkExistingTaskMenu
        open
        onOpenChange={vi.fn()}
        parentId={parentId}
        parentNumber={parentNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy docs site'))

    expect(screen.getByText('Change parent task?')).toBeInTheDocument()
    expect(
      screen.getByText(
        '#34 Deploy docs site currently belongs to #3. It will be moved under #1.',
      ),
    ).toBeInTheDocument()
  })

  it('moves an orphan candidate directly and closes without a confirm dialog', async () => {
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
      <LinkExistingTaskMenu
        open
        onOpenChange={onOpenChange}
        parentId={parentId}
        parentNumber={parentNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy to production'))

    expect(mutate).toHaveBeenCalledWith(
      { id: orphanCandidate.id, parentId },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(screen.queryByText('Change parent task?')).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a no-results message when the search returns nothing', async () => {
    mockSearchResults([])
    const user = userEvent.setup()
    render(
      <LinkExistingTaskMenu
        open
        onOpenChange={vi.fn()}
        parentId={parentId}
        parentNumber={parentNumber}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('no results for "Deploy"')).toBeInTheDocument()
  })
})
