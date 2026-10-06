import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { TaskChecklistSection } from '#components/task/task-checklist-section'
import { useSetTaskChecklistItemChecked } from '#hooks/use-task-checklists'

const { mockGetChecklists, mockCreateChecklist, mockCheck, mockUncheck } =
  vi.hoisted(() => ({
    mockGetChecklists: vi.fn(),
    mockCreateChecklist: vi.fn(),
    mockCheck: vi.fn(),
    mockUncheck: vi.fn(),
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
          check: { $post: mockCheck },
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
        ['tasks', 'detail', taskId, 'checklists'],
        ['tasks', 'detail', taskId, 'checklists'],
      ],
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
        <TaskChecklistSection taskId={taskId} />
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
