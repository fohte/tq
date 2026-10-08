import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LinkExistingTaskMenu } from '#components/task/link-existing-task-menu'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import {
  useSelfAndDescendantIds,
  useTaskList,
  useUpdateTaskParent,
} from '#hooks/use-tasks'
import {
  mutateInvokingOnSuccess,
  partialMutation,
  withOnSuccess,
} from '#lib/test-utils'

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
    useSelfAndDescendantIds: vi.fn(),
    useTaskList: vi.fn(),
    useUpdateTaskParent: vi.fn(),
  }
})

const mockUseSearchTasks = vi.mocked(useSearchTasks)
const mockUseSelfAndDescendantIds = vi.mocked(useSelfAndDescendantIds)
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

function uniqueTaskListCalls<T>(calls: T[]) {
  const seen = new Set<string | undefined>()
  return calls.filter((call) => {
    const key = JSON.stringify(call)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const parentId = '00000000-0000-0000-0000-000000000001'
const parentNumber = 1
const parentTitle = 'Current parent'

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
})

const parentCandidate: SearchResult = makeTask({
  id: parentId,
  number: parentNumber,
  title: parentTitle,
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
    mockUseSelfAndDescendantIds.mockImplementation((taskId, enabled) => {
      const { categorized } = mockUseTaskList(
        { descendantOf: taskId },
        { enabled },
      )
      return new Set([taskId, ...categorized.all.map((task) => task.id)])
    })
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
        parentTitle={parentTitle}
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
        parentTitle={parentTitle}
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
    const mutate = mutateInvokingOnSuccess<UpdateTaskParentResult['mutate']>()
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
        parentTitle={parentTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy to production'))

    expect(mutate).toHaveBeenCalledWith(
      {
        id: orphanCandidate.id,
        parentId,
        parent: { number: parentNumber, title: parentTitle },
      },
      withOnSuccess,
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
        parentTitle={parentTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('no results for "Deploy"')).toBeInTheDocument()
  })

  it('loads descendants only while the menu is open', () => {
    mockSearchResults([])
    mockUseTaskList.mockClear()
    const props = {
      onOpenChange: vi.fn(),
      parentId,
      parentNumber,
      parentTitle,
    }
    const { rerender } = render(<LinkExistingTaskMenu {...props} open />)

    rerender(<LinkExistingTaskMenu {...props} open={false} />)

    expect(
      uniqueTaskListCalls(
        mockUseTaskList.mock.calls.map(([filter, options]) => ({
          filter,
          enabled: options?.enabled,
        })),
      ),
    ).toEqual([
      { filter: { descendantOf: parentId }, enabled: true },
      { filter: { descendantOf: parentId }, enabled: false },
    ])
  })

  it('excludes the parent and descendants from link candidates', async () => {
    const descendant = makeTask({
      id: '00000000-0000-0000-0000-000000000013',
      number: 18,
      title: 'Deploy staging',
      parentId,
    })
    mockUseTaskList.mockReturnValue(
      partialMutation<ReturnType<typeof useTaskList>>({
        categorized: { all: [descendant] },
      }),
    )
    mockSearchResults([parentCandidate, orphanCandidate, descendant])
    const user = userEvent.setup()
    render(
      <LinkExistingTaskMenu
        open
        onOpenChange={vi.fn()}
        parentId={parentId}
        parentNumber={parentNumber}
        parentTitle={parentTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(
      candidateSnapshot(
        screen
          .getAllByRole('button', { name: /^#\d+ / })
          .map((element) => element.textContent),
        uniqueTaskListCalls(
          mockUseTaskList.mock.calls.map(([filter, options]) => ({
            filter,
            enabled: options?.enabled,
          })),
        ).filter(({ enabled }) => enabled === true),
      ),
    ).toEqual({
      candidateTitles: [
        `#${String(orphanCandidate.number)}${orphanCandidate.title}`,
      ],
      taskListCalls: [{ filter: { descendantOf: parentId }, enabled: true }],
    })
  })
})

function candidateSnapshot(
  candidateTitles: (string | null)[],
  taskListCalls: unknown[],
) {
  return { candidateTitles, taskListCalls }
}
