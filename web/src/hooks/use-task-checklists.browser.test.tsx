import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskChecklistSection } from '#components/task/task-checklist-section'
import {
  useLinkTaskChecklistItemToGithub,
  usePromoteTaskChecklistItem,
  useSetTaskChecklistItemChecked,
} from '#hooks/use-task-checklists'
import { taskChecklistKeys } from '#lib/query-keys'

const {
  mockGetChecklists,
  mockCreateChecklist,
  mockCheck,
  mockUncheck,
  mockUpdateChecklistItem,
  mockPromoteChecklistItem,
} = vi.hoisted(() => ({
  mockGetChecklists: vi.fn(),
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

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  mockGetChecklists.mockReset().mockImplementation(checklistResponse)
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
