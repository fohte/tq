import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskChecklistSection } from '#components/task/task-checklist-section'
import {
  makeTaskChecklist,
  makeTaskChecklistItem,
} from '#components/task/task-checklist-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import {
  useLinkTaskChecklistItemToGithub,
  usePromoteTaskChecklistItem,
  useSetTaskChecklistItemChecked,
} from '#hooks/use-task-checklists'
import { taskChecklistKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

const {
  mockGetChecklists,
  mockGetTasks,
  mockCreateChecklist,
  mockCheck,
  mockUncheck,
  mockUpdateChecklistItem,
  mockPromoteChecklistItem,
} = vi.hoisted(() => ({
  mockGetChecklists: vi.fn(),
  mockGetTasks: vi.fn(),
  mockCreateChecklist: vi.fn(),
  mockCheck: vi.fn(),
  mockUncheck: vi.fn(),
  mockUpdateChecklistItem: vi.fn(),
  mockPromoteChecklistItem: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        $get: mockGetTasks,
        ':taskId': {
          checklists: {
            $get: mockGetChecklists,
            $post: mockCreateChecklist,
          },
        },
      },
      'checklist-items': {
        ':itemId': {
          $patch: mockUpdateChecklistItem,
          check: { $post: mockCheck },
          promote: { $post: mockPromoteChecklistItem },
          uncheck: { $post: mockUncheck },
        },
      },
    },
  },
}))

const taskId = '10000000-0000-4000-8000-000000000401'
const itemId = '30000000-0000-4000-8000-000000000401'

let queryClient: QueryClient

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function successResponse() {
  return new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function checklistResponse() {
  return new Response('[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function taskListResponse(tasks: ReturnType<typeof makeTask>[]) {
  return new Response(JSON.stringify(tasks), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

function readCheckMutationState(invalidationKeys: unknown[]) {
  return {
    checkCalls: mockCheck.mock.calls,
    uncheckCalls: mockUncheck.mock.calls,
    invalidationKeys,
  }
}

function readChecklistSaveFailure(alertText: string | null) {
  return {
    alertText,
    createCalls: mockCreateChecklist.mock.calls,
  }
}

function readLinkMutationState(invalidationKeys: unknown[]) {
  return {
    updateCalls: mockUpdateChecklistItem.mock.calls,
    invalidationKeys,
  }
}

function readPromoteMutationState(invalidationKeys: unknown[]) {
  return {
    promoteCalls: mockPromoteChecklistItem.mock.calls,
    invalidationKeys,
  }
}

function readFetchedSubtaskState(link: HTMLElement, taskListRequests: unknown) {
  return {
    link: {
      label: link.getAttribute('aria-label'),
      href: link.getAttribute('href'),
    },
    taskListRequests,
  }
}

function readChecklistLinkFailureState(
  error: HTMLElement,
  dialogOpen: boolean,
  url: string | null,
  linkCalls: unknown,
) {
  return {
    errorMessage: error.textContent,
    dialogOpen,
    url,
    linkCalls,
  }
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  mockGetChecklists.mockReset().mockImplementation(checklistResponse)
  mockGetTasks.mockReset().mockImplementation(() => taskListResponse([]))
  mockCreateChecklist.mockReset()
  mockCheck.mockReset().mockResolvedValue(successResponse())
  mockUncheck.mockReset().mockResolvedValue(successResponse())
  mockUpdateChecklistItem.mockReset().mockResolvedValue(successResponse())
  mockPromoteChecklistItem.mockReset().mockResolvedValue(successResponse())
})

afterEach(() => {
  queryClient.clear()
})

describe('useSetTaskChecklistItemChecked', () => {
  it('uses the matching endpoint and invalidates the checklist after checking changes', async () => {
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(
      () => useSetTaskChecklistItemChecked(taskId),
      {
        wrapper,
      },
    )

    await act(async () => {
      await result.current.mutateAsync({ itemId, checked: true })
      await result.current.mutateAsync({ itemId, checked: false })
    })

    expect(
      readCheckMutationState(
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      checkCalls: [[{ param: { itemId } }]],
      uncheckCalls: [[{ param: { itemId } }]],
      invalidationKeys: [
        taskChecklistKeys.all(taskId),
        taskChecklistKeys.all(taskId),
      ],
    })
  })
})

describe('useLinkTaskChecklistItemToGithub', () => {
  it('links a pull request and invalidates task data', async () => {
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => useLinkTaskChecklistItemToGithub(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync({
        itemId,
        url: 'https://github.com/example-org/sample-app/pull/14',
      })
    })

    expect(
      readLinkMutationState(
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      updateCalls: [
        [
          {
            param: { itemId },
            json: {
              github: 'https://github.com/example-org/sample-app/pull/14',
            },
          },
        ],
      ],
      invalidationKeys: [['tasks']],
    })
  })
})

describe('usePromoteTaskChecklistItem', () => {
  it('promotes an item and invalidates task data', async () => {
    const invalidateQueries = vi
      .spyOn(queryClient, 'invalidateQueries')
      .mockResolvedValue(undefined)
    const { result } = renderHook(() => usePromoteTaskChecklistItem(), {
      wrapper,
    })

    await act(async () => {
      await result.current.mutateAsync(itemId)
    })

    expect(
      readPromoteMutationState(
        invalidateQueries.mock.calls.map(([filters]) => filters?.queryKey),
      ),
    ).toEqual({
      promoteCalls: [[{ param: { itemId } }]],
      invalidationKeys: [['tasks']],
    })
  })
})

describe('TaskChecklistSection', () => {
  it('loads linked subtasks when task detail data omits them', async () => {
    const subtaskId = '50000000-0000-4000-8000-000000000401'
    const subtask = makeTask({
      id: subtaskId,
      number: 27,
      title: 'Add retry handling',
      parentId: taskId,
    })
    mockGetTasks.mockResolvedValue(taskListResponse([subtask]))
    mockGetChecklists.mockImplementation(
      () =>
        new Response(
          JSON.stringify([
            makeTaskChecklist({
              items: [
                makeTaskChecklistItem({
                  id: itemId,
                  content: 'Add retry handling',
                  subtaskId,
                }),
              ],
            }),
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    )
    render(
      <QueryClientProvider client={queryClient}>
        <StoryRouter
          component={() => (
            <TaskChecklistSection taskId={taskId} githubLinks={[]} />
          )}
          paths={['/tasks/$taskId']}
        />
      </QueryClientProvider>,
    )

    const link = await screen.findByRole('link', {
      name: '#27 Add retry handling',
    })

    expect(readFetchedSubtaskState(link, mockGetTasks.mock.calls)).toEqual({
      link: {
        label: '#27 Add retry handling',
        href: `/tasks/${subtaskId}`,
      },
      taskListRequests: [
        [
          {
            query: {
              parentId: taskId,
              hasDue: undefined,
              includeAncestors: undefined,
            },
          },
        ],
      ],
    })
  })

  it('shows the server error and keeps the URL when linking fails', async () => {
    const user = userEvent.setup()
    const url = 'https://github.com/example-org/sample-app/issues/14'
    mockGetChecklists.mockImplementation(
      () =>
        new Response(
          JSON.stringify([
            makeTaskChecklist({
              items: [
                makeTaskChecklistItem({
                  id: itemId,
                  content: 'Add retry handling',
                }),
              ],
            }),
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
    )
    mockUpdateChecklistItem.mockResolvedValue(
      new Response(
        JSON.stringify({ error: 'This URL must point to a pull request.' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    render(
      <QueryClientProvider client={queryClient}>
        <TaskChecklistSection taskId={taskId} githubLinks={[]} subtasks={[]} />
      </QueryClientProvider>,
    )

    await user.click(
      await screen.findByRole('button', {
        name: 'Actions for Add retry handling',
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', { name: 'link pull request' }),
    )
    const input = await screen.findByRole('textbox', {
      name: 'Pull request URL',
    })
    await user.type(input, url)
    await user.click(screen.getByRole('button', { name: 'Link' }))
    const error = await screen.findByText(
      'This URL must point to a pull request.',
    )

    expect(
      readChecklistLinkFailureState(
        error,
        screen.queryByRole('dialog') != null,
        input instanceof HTMLInputElement ? input.value : null,
        mockUpdateChecklistItem.mock.calls,
      ),
    ).toEqual({
      errorMessage: 'This URL must point to a pull request.',
      dialogOpen: true,
      url,
      linkCalls: [
        [
          {
            param: { itemId },
            json: { github: url },
          },
        ],
      ],
    })
  })

  it('shows an error when saving a checklist fails', async () => {
    const user = userEvent.setup()
    mockCreateChecklist.mockResolvedValue(
      new Response('{"error":"Unavailable"}', {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    render(
      <QueryClientProvider client={queryClient}>
        <TaskChecklistSection taskId={taskId} githubLinks={[]} subtasks={[]} />
      </QueryClientProvider>,
    )

    await user.click(
      await screen.findByRole('button', { name: 'add checklist' }),
    )
    const alert = await screen.findByRole('alert')

    expect(readChecklistSaveFailure(alert.textContent)).toEqual({
      alertText: 'Failed to save checklist changes.',
      createCalls: [[{ param: { taskId }, json: { name: null } }]],
    })
  })
})
