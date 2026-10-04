import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  makeGithubBlocker,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { TaskDependenciesSection } from '#components/task/task-dependencies-section'
import {
  useResolveGithubUrlQuery,
  useUpdateGithubLinkNotifyEvents,
} from '#hooks/use-github-link'
import { useSearchTasks } from '#hooks/use-search'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-github-link', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-github-link')>()
  return {
    ...original,
    useResolveGithubUrlQuery: vi.fn(),
    useUpdateGithubLinkNotifyEvents: vi.fn(),
  }
})

vi.mock('#hooks/use-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-search')>()
  return { ...original, useSearchTasks: vi.fn() }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return { ...original, useUpdateTaskBlockedBy: vi.fn() }
})

const taskId = '00000000-0000-0000-0000-000000000001'
const mockUseResolveGithubUrlQuery = vi.mocked(useResolveGithubUrlQuery)
const mockUseUpdateGithubLinkNotifyEvents = vi.mocked(
  useUpdateGithubLinkNotifyEvents,
)
const mockUseSearchTasks = vi.mocked(useSearchTasks)
const mockUseUpdateTaskBlockedBy = vi.mocked(useUpdateTaskBlockedBy)
const updateBlockedBy = vi.fn()
const updateNotifyEvents = vi.fn()

beforeEach(() => {
  updateBlockedBy.mockReset()
  updateNotifyEvents.mockReset()
  mockUseResolveGithubUrlQuery.mockReturnValue(
    partialMutation<ReturnType<typeof useResolveGithubUrlQuery>>({
      data: undefined,
      error: null,
      isFetching: false,
    }),
  )
  mockUseUpdateGithubLinkNotifyEvents.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateGithubLinkNotifyEvents>>({
      mutate: updateNotifyEvents,
      isPending: false,
    }),
  )
  mockUseSearchTasks.mockReturnValue(
    partialMutation<ReturnType<typeof useSearchTasks>>({
      data: [],
      isFetching: false,
    }),
  )
  mockUseUpdateTaskBlockedBy.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateTaskBlockedBy>>({
      mutate: updateBlockedBy,
      isPending: false,
    }),
  )
})

describe('TaskDependenciesSection', () => {
  it('updates notification events for a GitHub blocker', async () => {
    const githubBlockers = [makeGithubBlocker({ id: 'github-blocker-open' })]
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={githubBlockers}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Notify on: closed' }))
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'new comments' }),
    )

    expect(updateNotifyEvents.mock.calls).toEqual([
      [
        {
          linkId: 'github-blocker-open',
          notifyEvents: ['closed', 'comments'],
        },
      ],
    ])
  })

  it('removes only the selected GitHub blocker', async () => {
    const githubBlockers = [
      makeGithubBlocker({ id: 'github-blocker-open' }),
      makeGithubBlocker({
        id: 'github-blocker-merged',
        owner: 'sample-group',
        repo: 'sample-cli',
        number: 87,
        state: 'merged',
        title: 'Add the config file option',
        notifyEvents: [],
        url: 'https://github.com/sample-group/sample-cli/pull/87',
      }),
    ]
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={githubBlockers}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Remove example-team/sample-project#2048 as blocker',
      }),
    )

    expect(updateBlockedBy.mock.calls).toEqual([
      [
        {
          id: taskId,
          blockedBy: [],
          githubBlockerUrls: [
            'https://github.com/sample-group/sample-cli/pull/87',
          ],
        },
      ],
    ])
  })

  it('adds a resolved GitHub URL while retaining existing blockers', async () => {
    const existingBlocker = makeGithubBlocker({
      id: 'github-blocker-existing',
    })
    const githubUrl =
      'https://github.com/example-team/sample-project/issues/16384'
    const resolution = makeResolveGithubUrlResult({
      owner: 'example-team',
      repo: 'sample-project',
      number: 16384,
      kind: 'issue',
      url: githubUrl,
      title: 'Document the build process',
    })
    mockUseResolveGithubUrlQuery.mockImplementation((url, enabled) =>
      partialMutation<ReturnType<typeof useResolveGithubUrlQuery>>({
        data: enabled && url === githubUrl ? resolution : undefined,
        error: null,
        isFetching: false,
      }),
    )
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[existingBlocker]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'add blocker' }))
    await user.type(
      screen.getByPlaceholderText(
        'Search tasks or paste a GitHub issue/PR URL...',
      ),
      githubUrl,
    )
    await user.click(await screen.findByText('Document the build process'))

    expect(updateBlockedBy.mock.calls).toEqual([
      [
        {
          id: taskId,
          blockedBy: [],
          githubBlockerUrls: [existingBlocker.url, githubUrl],
        },
      ],
    ])
  })

  it('shows an error when updating blockers fails', () => {
    const error = new Error('Example failure')
    mockUseUpdateTaskBlockedBy.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateTaskBlockedBy>>({
        mutate: updateBlockedBy,
        isPending: false,
        isError: true,
        error,
      }),
    )

    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toBe('Example failure')
  })
})
