import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...original,
    useSearchTasks: vi.fn(),
  }
})

const mockUseSearchTasks = vi.mocked(useSearchTasks)

type SearchTasksResult = ReturnType<typeof useSearchTasks>

function mockSearchResults(data: SearchResult[], isFetching = false) {
  mockUseSearchTasks.mockReturnValue(
    partialMutation<SearchTasksResult>({ data, isFetching }),
  )
}

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

const excludedCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000013',
  number: 56,
  title: 'Deploy staging environment',
})

describe('TaskSearchCandidateDialog', () => {
  it('shows results returned by the search hook once a query is typed', async () => {
    mockSearchResults([orphanCandidate, candidateWithParent])
    const user = userEvent.setup()
    render(
      <TaskSearchCandidateDialog
        open
        onOpenChange={vi.fn()}
        title="Link existing task"
        excludedTaskIds={new Set()}
        onSelectCandidate={vi.fn()}
      />,
    )

    expect(screen.getByText('Type to search tasks')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.getByText('Deploy docs site')).toBeInTheDocument()
    expect(screen.getByText('← #3')).toBeInTheDocument()
  })

  it('filters out excluded task ids from the results', async () => {
    mockSearchResults([orphanCandidate, excludedCandidate])
    const user = userEvent.setup()
    render(
      <TaskSearchCandidateDialog
        open
        onOpenChange={vi.fn()}
        title="Link existing task"
        excludedTaskIds={new Set([excludedCandidate.id])}
        onSelectCandidate={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(
      screen.queryByText('Deploy staging environment'),
    ).not.toBeInTheDocument()
  })

  it('calls onSelectCandidate when a candidate is clicked', async () => {
    mockSearchResults([candidateWithParent])
    const onSelectCandidate = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskSearchCandidateDialog
        open
        onOpenChange={vi.fn()}
        title="Link existing task"
        excludedTaskIds={new Set()}
        onSelectCandidate={onSelectCandidate}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy docs site'))

    expect(onSelectCandidate).toHaveBeenCalledWith(candidateWithParent)
  })

  it('calls skipAction.onSkip when the skip button is clicked', async () => {
    mockSearchResults([orphanCandidate])
    const onSkip = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskSearchCandidateDialog
        open
        onOpenChange={vi.fn()}
        title="Duplicate of"
        excludedTaskIds={new Set()}
        onSelectCandidate={vi.fn()}
        skipAction={{ label: 'Close without linking', onSkip }}
      />,
    )

    await user.click(screen.getByText('Close without linking'))

    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('shows a no-results message when the search returns nothing', async () => {
    mockSearchResults([])
    const user = userEvent.setup()
    render(
      <TaskSearchCandidateDialog
        open
        onOpenChange={vi.fn()}
        title="Link existing task"
        excludedTaskIds={new Set()}
        onSelectCandidate={vi.fn()}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('no results for "Deploy"')).toBeInTheDocument()
  })
})
