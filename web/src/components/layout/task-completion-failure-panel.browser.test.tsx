import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TaskCompletionFailurePanel } from '#components/layout/task-completion-failure-panel'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { useCompleteTask } from '#hooks/use-task-mutations'

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000'
const TASK_NUMBER = 71
const WAIT_ID = '550e8400-e29b-41d4-a716-446655440099'

function CompletionAttempt() {
  const completeTask = useCompleteTask()
  return (
    <button
      type="button"
      onClick={() => {
        completeTask.mutate({ id: TASK_ID, taskNumber: TASK_NUMBER })
      }}
    >
      Complete task
    </button>
  )
}

function createHarness() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <CompletionAttempt />
      <TaskCompletionFailurePanel />
    </QueryClientProvider>,
  )
}

function getPanelOutput() {
  const panel = screen.getByRole('alert')
  return [
    panel.querySelector('h2')?.textContent,
    panel.querySelector('span.min-w-0')?.textContent,
    panel.querySelector('p')?.textContent,
    screen.getByRole('button', { name: 'Complete' }).hasAttribute('disabled'),
  ]
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TaskCompletionFailurePanel', () => {
  it('shows the blocker panel when a completion request receives a 409 response', async () => {
    const wait = {
      id: WAIT_ID,
      label: 'Reply from a supplier',
      followUpDate: '2026-11-04',
      githubLinkId: null,
      resolvedAt: null,
      acknowledgedAt: null,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              error:
                'Task is blocked by unresolved blockers: wait Reply from a supplier',
              blockedByNumbers: [],
              blockedByGithubRefs: [],
              blockedByWaits: [wait],
            }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
          )
        }
        const inputUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        if (inputUrl.includes(TASK_ID)) {
          return new Response(
            JSON.stringify(
              makeTaskDetail({
                id: TASK_ID,
                number: TASK_NUMBER,
                waits: [
                  {
                    ...wait,
                    taskId: TASK_ID,
                    body: null,
                    createdAt: '2026-11-03T00:00:00.000Z',
                  },
                ],
              }),
            ),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return new Response('{}', {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }),
    )
    createHarness()

    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }))

    await waitFor(() => {
      expect(getPanelOutput()).toEqual([
        "Couldn't complete #71",
        'Reply from a supplier',
        'Blocked by 1 unresolved item.',
        true,
      ])
    })
  })
})
