import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  makeGithubBlocker,
  makeResolveGithubUrlResult,
} from '#components/task/github-link-test-fixtures'
import { TaskDependenciesSection } from '#components/task/task-dependencies-section'
import { makeTaskWait } from '#components/task/task-wait-test-fixtures'
import {
  useResolveGithubUrlQuery,
  useUpdateGithubLinkNotifyEvents,
} from '#hooks/use-github-link'
import { useSearchTasks } from '#hooks/use-search'
import {
  useCreateTaskWait,
  useDeleteTaskWait,
  useResolveTaskWait,
  useUpdateTaskWait,
} from '#hooks/use-task-waits'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'
import { addLocalDays, formatLocalDate } from '#lib/date-range'
import {
  assertDefined,
  partialMutation,
  waitForEditorFocus,
} from '#lib/test-utils'

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

vi.mock('#hooks/use-task-waits', () => ({
  useCreateTaskWait: vi.fn(),
  useDeleteTaskWait: vi.fn(),
  useResolveTaskWait: vi.fn(),
  useUpdateTaskWait: vi.fn(),
}))

const taskId = '00000000-0000-0000-0000-000000000001'
const mockUseResolveGithubUrlQuery = vi.mocked(useResolveGithubUrlQuery)
const mockUseUpdateGithubLinkNotifyEvents = vi.mocked(
  useUpdateGithubLinkNotifyEvents,
)
const mockUseSearchTasks = vi.mocked(useSearchTasks)
const mockUseUpdateTaskBlockedBy = vi.mocked(useUpdateTaskBlockedBy)
const mockUseCreateTaskWait = vi.mocked(useCreateTaskWait)
const mockUseDeleteTaskWait = vi.mocked(useDeleteTaskWait)
const mockUseResolveTaskWait = vi.mocked(useResolveTaskWait)
const mockUseUpdateTaskWait = vi.mocked(useUpdateTaskWait)
const updateBlockedBy = vi.fn()
const updateNotifyEvents = vi.fn()
const createWait = vi.fn<ReturnType<typeof useCreateTaskWait>['mutate']>()
let createWaitError: Error | null = null
const resetCreateWait = vi.fn(() => {
  createWaitError = null
})
const updateWait = vi.fn<ReturnType<typeof useUpdateTaskWait>['mutate']>()
const resolveWait = vi.fn<ReturnType<typeof useResolveTaskWait>['mutate']>()
const deleteWait = vi.fn<ReturnType<typeof useDeleteTaskWait>['mutate']>()

beforeAll(async () => {
  await import('#components/ui/markdown-editor-crepe')
}, 20_000)

beforeEach(() => {
  updateBlockedBy.mockReset()
  updateNotifyEvents.mockReset()
  createWait.mockReset()
  createWaitError = null
  resetCreateWait.mockClear()
  updateWait.mockReset()
  resolveWait.mockReset()
  deleteWait.mockReset()
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
  mockUseCreateTaskWait.mockImplementation(() =>
    partialMutation<ReturnType<typeof useCreateTaskWait>>({
      mutate: createWait,
      isPending: false,
      error: createWaitError,
      reset: resetCreateWait,
    }),
  )
  mockUseUpdateTaskWait.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateTaskWait>>({
      mutate: updateWait,
      isPending: false,
    }),
  )
  mockUseResolveTaskWait.mockReturnValue(
    partialMutation<ReturnType<typeof useResolveTaskWait>>({
      mutate: resolveWait,
      isPending: false,
    }),
  )
  mockUseDeleteTaskWait.mockReturnValue(
    partialMutation<ReturnType<typeof useDeleteTaskWait>>({
      mutate: deleteWait,
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
        waits={[]}
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
        waits={[]}
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
        waits={[]}
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
        waits={[]}
      />,
    )

    expect(screen.getByRole('alert').textContent).toBe('Example failure')
  })

  it('adds a reply wait from the final candidate and submits its follow-up date', async () => {
    mockUseSearchTasks.mockReturnValue(
      partialMutation<ReturnType<typeof useSearchTasks>>({
        data: [],
        isFetching: false,
      }),
    )
    const user = userEvent.setup()
    const followUpDate = addLocalDays(formatLocalDate(new Date()), 3)
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'add blocker' }))
    await user.type(
      screen.getByPlaceholderText(
        'Search tasks or paste a GitHub issue/PR URL...',
      ),
      'Review feedback',
    )
    await user.click(screen.getByText('Wait for “Review feedback”'))

    const bodyInput = screen.getByRole('textbox', { name: 'Wait description' })
    const followUpInput = screen.getByLabelText('Follow-up date')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    const readActual = () => ({
      body: bodyInput instanceof HTMLTextAreaElement ? bodyInput.value : null,
      followUpDate:
        followUpInput instanceof HTMLInputElement ? followUpInput.value : null,
      createCalls: createWait.mock.calls.map(([input]) => input),
    })

    expect(readActual()).toEqual({
      body: 'Review feedback',
      followUpDate,
      createCalls: [{ taskId, body: 'Review feedback', followUpDate }],
    })
  })

  it('saves a complete follow-up date after keyboard edits finish', () => {
    const wait = makeTaskWait({
      id: 'wait-example-007',
      body: 'Review feedback',
      label: 'Review feedback',
      followUpDate: '2099-10-13',
    })
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[wait]}
      />,
    )

    const input = screen.getByLabelText('Follow-up date for Review feedback')
    fireEvent.change(input, { target: { value: '0002-10-13' } })
    fireEvent.change(input, { target: { value: '0020-10-13' } })
    fireEvent.change(input, { target: { value: '0202-10-13' } })
    fireEvent.change(input, { target: { value: '2027-10-13' } })
    fireEvent.blur(input)

    const readActual = () => ({
      updateCalls: updateWait.mock.calls.map(([input]) => input),
      dateValue: input instanceof HTMLInputElement ? input.value : null,
    })

    expect(readActual()).toEqual({
      updateCalls: [{ waitId: wait.id, followUpDate: '2027-10-13' }],
      dateValue: '2027-10-13',
    })
  })

  it('resolves the selected reply wait', async () => {
    const wait = makeTaskWait({ label: 'Review feedback' })
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[wait]}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Resolve wait: Review feedback' }),
    )

    expect(resolveWait.mock.calls).toEqual([[wait.id]])
  })

  it('removes the selected reply wait', async () => {
    const wait = makeTaskWait({ label: 'Review feedback' })
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[wait]}
      />,
    )

    await user.click(
      screen.getByRole('button', { name: 'Remove wait: Review feedback' }),
    )

    expect(deleteWait.mock.calls).toEqual([[wait.id]])
  })

  it('saves edited wait details when leaving the inline editor', async () => {
    const wait = makeTaskWait({
      body: 'Review feedback details',
      label: 'Review feedback',
    })
    const user = userEvent.setup()
    const { container } = render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[wait]}
      />,
    )

    await user.click(
      await screen.findByText(
        'Review feedback details',
        {},
        { timeout: 20_000 },
      ),
    )
    const editor = assertDefined(
      container.querySelector('.milkdown .ProseMirror'),
      'the wait details render a Markdown editor',
    )
    await waitForEditorFocus(editor)
    await user.keyboard('!')
    await waitFor(() => {
      expect(editor.textContent).toEqual('!Review feedback details')
    })
    await new Promise((resolve) => setTimeout(resolve, 300))
    await user.click(
      screen.getByRole('button', { name: 'Resolve wait: Review feedback' }),
    )

    const readActual = () => ({
      updateCalls: updateWait.mock.calls.map(([input]) => input),
      resolveCalls: resolveWait.mock.calls,
    })
    expect(readActual()).toEqual({
      updateCalls: [{ waitId: wait.id, body: '!Review feedback details\n' }],
      resolveCalls: [[wait.id]],
    })
  }, 45_000)

  it('clears the previous create error when opening another wait dialog', async () => {
    createWaitError = new Error('Previous failure')
    const user = userEvent.setup()
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[]}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'add blocker' }))
    await user.type(
      screen.getByPlaceholderText(
        'Search tasks or paste a GitHub issue/PR URL...',
      ),
      'Another request',
    )
    await user.click(screen.getByText('Wait for “Another request”'))

    const readActual = () => ({
      resetCalls: resetCreateWait.mock.calls,
      alerts: screen.queryAllByRole('alert').map((alert) => alert.textContent),
    })
    expect(readActual()).toEqual({ resetCalls: [[]], alerts: [] })
  })

  it('shows a resolve failure next to the reply wait', () => {
    mockUseResolveTaskWait.mockReturnValue(
      partialMutation<ReturnType<typeof useResolveTaskWait>>({
        mutate: resolveWait,
        isPending: false,
        isError: true,
        error: new Error('Resolve failed'),
      }),
    )
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[makeTaskWait()]}
      />,
    )

    const readActual = () =>
      screen.getAllByRole('alert').map((alert) => alert.textContent)
    expect(readActual()).toEqual(['Resolve failed'])
  })

  it('shows a delete failure next to the reply wait', () => {
    mockUseDeleteTaskWait.mockReturnValue(
      partialMutation<ReturnType<typeof useDeleteTaskWait>>({
        mutate: deleteWait,
        isPending: false,
        isError: true,
        error: new Error('Delete failed'),
      }),
    )
    render(
      <TaskDependenciesSection
        taskId={taskId}
        blockedBy={[]}
        blocking={[]}
        githubBlockers={[]}
        waits={[makeTaskWait()]}
      />,
    )

    const readActual = () =>
      screen.getAllByRole('alert').map((alert) => alert.textContent)
    expect(readActual()).toEqual(['Delete failed'])
  })
})
