import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TaskCompletionFailurePanel } from '#components/layout/task-completion-failure-panel'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { useCompleteTask, useUpdateTaskStatus } from '#hooks/use-task-mutations'
import { createStoryRouter } from '#storybook-config/story-router'

const TASK_ID = '550e8400-e29b-41d4-a716-446655440000'
const TASK_NUMBER = 71
const WAIT_ID = '550e8400-e29b-41d4-a716-446655440099'
const SECOND_TASK_ID = '550e8400-e29b-41d4-a716-446655440001'
const SECOND_TASK_NUMBER = 72
const SECOND_WAIT_ID = '550e8400-e29b-41d4-a716-446655440098'

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

function StatusCompletionAttempt() {
  const updateStatus = useUpdateTaskStatus()
  return (
    <button
      type="button"
      onClick={() => {
        updateStatus.mutate({
          id: TASK_ID,
          taskNumber: TASK_NUMBER,
          status: 'completed',
        })
      }}
    >
      Complete through status
    </button>
  )
}

function MultiTaskCompletionAttempt() {
  const completeTask = useCompleteTask()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          completeTask.mutate({ id: TASK_ID, taskNumber: TASK_NUMBER })
        }}
      >
        Complete task #71
      </button>
      <button
        type="button"
        onClick={() => {
          completeTask.mutate({
            id: SECOND_TASK_ID,
            taskNumber: SECOND_TASK_NUMBER,
          })
        }}
      >
        Complete task #72
      </button>
    </>
  )
}

async function createHarness(attempt: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const router = createStoryRouter({
    component: () => (
      <QueryClientProvider client={queryClient}>
        {attempt}
        <TaskCompletionFailurePanel />
      </QueryClientProvider>
    ),
    paths: ['/tasks/$taskId'],
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

function getRequestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input
  return input instanceof URL ? input.href : input.url
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function taskWithWaitFor(
  id: string,
  number: number,
  wait: typeof WAIT,
  resolvedAt: string | null,
) {
  return makeTaskDetail({
    id,
    number,
    waits: [
      {
        ...wait,
        resolvedAt,
        taskId: TASK_ID,
        body: null,
        createdAt: '2026-11-03T00:00:00.000Z',
      },
    ],
  })
}

function taskWithWait(wait: typeof WAIT, resolvedAt: string | null) {
  return taskWithWaitFor(TASK_ID, TASK_NUMBER, wait, resolvedAt)
}

const WAIT = {
  id: WAIT_ID,
  label: 'Reply from a supplier',
  followUpDate: '2026-11-04',
  githubLinkId: null,
  resolvedAt: null,
  acknowledgedAt: null,
}

const SECOND_WAIT = {
  ...WAIT,
  id: SECOND_WAIT_ID,
  label: 'Review the release notes',
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

function getGenericPanelOutput() {
  const panel = screen.getByRole('alert')
  return {
    label: panel.getAttribute('aria-label'),
    heading: panel.querySelector('h2')?.textContent,
    messages: [...panel.querySelectorAll('p')].map(
      (paragraph) => paragraph.textContent,
    ),
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('TaskCompletionFailurePanel', () => {
  it('shows the blocker panel when a completion request receives a 409 response', async () => {
    const wait = WAIT
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const input = args[0]
        const init = args[1]
        if (init?.method === 'POST') {
          return jsonResponse(
            {
              error:
                'Task is blocked by unresolved blockers: wait Reply from a supplier',
              blockedByNumbers: [],
              blockedByGithubRefs: [],
              blockedByWaits: [wait],
            },
            409,
          )
        }
        const inputUrl = getRequestUrl(input)
        if (inputUrl.includes(TASK_ID)) {
          return jsonResponse(taskWithWait(wait, null))
        }
        return jsonResponse({})
      }),
    )
    await createHarness(<CompletionAttempt />)

    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }))

    await waitFor(() => {
      expect(getPanelOutput()).toEqual([
        "Couldn't complete #71",
        'Reply from a supplier',
        'Blocked by 1 unresolved item.',
        true,
      ])
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss completion error' }),
    )
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toEqual(null)
    })
  })

  it('shows the panel when a completed-status PATCH receives a 409 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const init = args[1]
        if (init?.method === 'PATCH') {
          return jsonResponse(
            {
              error: 'Task is blocked by unresolved blockers: #24',
              blockedByNumbers: [24],
              blockedByGithubRefs: [],
            },
            409,
          )
        }
        return jsonResponse(
          makeTaskDetail({ id: TASK_ID, number: TASK_NUMBER }),
        )
      }),
    )
    await createHarness(<StatusCompletionAttempt />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete through status' }),
    )

    await waitFor(() => {
      expect(screen.getByRole('alert').getAttribute('aria-label')).toEqual(
        "Couldn't complete #71",
      )
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss completion error' }),
    )
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toEqual(null)
    })
  })

  it('closes on an unhandled Escape key and remains open when another UI prevents it', async () => {
    const wait = WAIT
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const input = args[0]
        const init = args[1]
        if (init?.method === 'PATCH') {
          return jsonResponse(
            {
              error:
                'Task is blocked by unresolved blockers: wait Reply from a supplier',
              blockedByNumbers: [],
              blockedByGithubRefs: [],
              blockedByWaits: [wait],
            },
            409,
          )
        }
        const inputUrl = getRequestUrl(input)
        if (inputUrl.includes(TASK_ID)) {
          return jsonResponse(taskWithWait(wait, null))
        }
        return jsonResponse({})
      }),
    )
    await createHarness(<StatusCompletionAttempt />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete through status' }),
    )
    await waitFor(() => {
      expect(getPanelOutput()).toEqual([
        "Couldn't complete #71",
        'Reply from a supplier',
        'Blocked by 1 unresolved item.',
        true,
      ])
    })

    const preventEscape = (event: KeyboardEvent) => {
      event.preventDefault()
    }
    document.addEventListener('keydown', preventEscape)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    document.removeEventListener('keydown', preventEscape)
    expect(getPanelOutput()).toEqual([
      "Couldn't complete #71",
      'Reply from a supplier',
      'Blocked by 1 unresolved item.',
      true,
    ])

    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toEqual(null)
    })
  })

  it('shows only the reason for JSON and non-JSON failures', async () => {
    let failureCount = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const init = args[1]
        if (init?.method === 'PATCH') {
          failureCount += 1
          return failureCount === 1
            ? jsonResponse({ error: 'The task could not be completed.' }, 500)
            : new Response('upstream unavailable', { status: 502 })
        }
        return jsonResponse(
          makeTaskDetail({ id: TASK_ID, number: TASK_NUMBER }),
        )
      }),
    )
    await createHarness(<StatusCompletionAttempt />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete through status' }),
    )
    await waitFor(() => {
      expect(getGenericPanelOutput()).toEqual({
        label: "Couldn't complete #71",
        heading: "Couldn't complete #71",
        messages: ['The task could not be completed.'],
      })
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss completion error' }),
    )
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toEqual(null)
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Complete through status' }),
    )
    await waitFor(() => {
      expect(getGenericPanelOutput()).toEqual({
        label: "Couldn't complete #71",
        heading: "Couldn't complete #71",
        messages: ['The server returned an error (502).'],
      })
    })
  })

  it('replaces the panel contents when a different task completion fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const input = args[0]
        const init = args[1]
        const inputUrl = getRequestUrl(input)
        if (init?.method === 'POST') {
          const wait = inputUrl.includes(SECOND_TASK_ID) ? SECOND_WAIT : WAIT
          return jsonResponse(
            {
              error: `Task is blocked by unresolved blockers: wait ${wait.label}`,
              blockedByNumbers: [],
              blockedByGithubRefs: [],
              blockedByWaits: [wait],
            },
            409,
          )
        }
        if (inputUrl.includes(SECOND_TASK_ID)) {
          return jsonResponse(
            taskWithWaitFor(
              SECOND_TASK_ID,
              SECOND_TASK_NUMBER,
              SECOND_WAIT,
              null,
            ),
          )
        }
        if (inputUrl.includes(TASK_ID)) {
          return jsonResponse(taskWithWait(WAIT, null))
        }
        return jsonResponse({})
      }),
    )
    await createHarness(<MultiTaskCompletionAttempt />)

    fireEvent.click(screen.getByRole('button', { name: 'Complete task #71' }))
    await waitFor(() => {
      expect(getPanelOutput()).toEqual([
        "Couldn't complete #71",
        'Reply from a supplier',
        'Blocked by 1 unresolved item.',
        true,
      ])
    })

    fireEvent.click(screen.getByRole('button', { name: 'Complete task #72' }))
    await waitFor(() => {
      expect(getPanelOutput()).toEqual([
        "Couldn't complete #72",
        'Review the release notes',
        'Blocked by 1 unresolved item.',
        true,
      ])
    })
  })

  it('keeps a wait unresolved when refreshed task details omit waits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const input = args[0]
        const init = args[1]
        if (init?.method === 'POST') {
          return jsonResponse(
            {
              error:
                'Task is blocked by unresolved blockers: wait Reply from a supplier',
              blockedByNumbers: [],
              blockedByGithubRefs: [],
              blockedByWaits: [WAIT],
            },
            409,
          )
        }
        const inputUrl = getRequestUrl(input)
        if (inputUrl.includes(TASK_ID)) {
          return jsonResponse({
            ...makeTaskDetail({ id: TASK_ID, number: TASK_NUMBER }),
            waits: undefined,
          })
        }
        return jsonResponse({})
      }),
    )
    await createHarness(<CompletionAttempt />)

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

  it('resolves a wait, retries completion, and closes the panel after success', async () => {
    const wait = WAIT
    let isWaitResolved = false
    let completeRequests = 0
    vi.stubGlobal(
      'fetch',
      vi.fn((...args: Parameters<typeof fetch>) => {
        const input = args[0]
        const init = args[1]
        const url = getRequestUrl(input)
        if (init?.method === 'POST' && url.endsWith('/resolve')) {
          isWaitResolved = true
          return jsonResponse({
            ...wait,
            taskId: TASK_ID,
            resolvedAt: '2026-11-03T01:00:00.000Z',
          })
        }
        if (init?.method === 'POST' && url.endsWith('/complete')) {
          completeRequests += 1
          if (completeRequests === 1) {
            return jsonResponse(
              {
                error:
                  'Task is blocked by unresolved blockers: wait Reply from a supplier',
                blockedByNumbers: [],
                blockedByGithubRefs: [],
                blockedByWaits: [wait],
              },
              409,
            )
          }
          return jsonResponse(
            makeTaskDetail({ id: TASK_ID, number: TASK_NUMBER }),
          )
        }
        if (url.includes(TASK_ID)) {
          return jsonResponse(
            taskWithWait(
              wait,
              isWaitResolved ? '2026-11-03T01:00:00.000Z' : null,
            ),
          )
        }
        return jsonResponse({})
      }),
    )
    await createHarness(<CompletionAttempt />)

    fireEvent.click(screen.getByRole('button', { name: 'Complete task' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Resolve' }))
    await waitFor(() => {
      if (
        screen
          .getByRole('button', { name: 'Complete' })
          .hasAttribute('disabled')
      ) {
        throw new Error(
          'completion stays disabled until the refreshed wait is resolved',
        )
      }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Complete' }))

    await waitFor(() => {
      expect(screen.queryByRole('alert')).toEqual(null)
    })
  })
})
