import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GeneratedTasksList } from '#components/recurring/generated-tasks-list'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { MockIntersectionObserver } from '#lib/mock-intersection-observer-test-utils'

const { mockGet, mockCount } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockCount: vi.fn(),
}))

vi.mock('#lib/api', () => ({
  api: { api: { tasks: { $get: mockGet, count: { $get: mockCount } } } },
}))

function jsonResponse(tasks: unknown[]) {
  return { ok: true, json: () => Promise.resolve(tasks) }
}

const templateId = '00000000-0000-0000-0000-000000000001'

async function renderGeneratedTasksList() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <GeneratedTasksList templateId={templateId} />,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([taskRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  MockIntersectionObserver.instances = []
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
  mockGet.mockReset()
  mockCount.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function generatedTasksListSnapshot(container: HTMLElement) {
  return {
    requests: mockGet.mock.calls,
    taskIds: [...container.querySelectorAll('a')].map((link) =>
      link.getAttribute('href')?.replace('/tasks/', ''),
    ),
  }
}

describe('GeneratedTasksList', () => {
  it('requests due-date-descending rows and preserves the API response order', async () => {
    const olderTask = makeTask({
      id: 'task-older',
      title: 'Older generated task',
      dueDate: '2026-03-20',
      templateId,
    })
    const newerTask = makeTask({
      id: 'task-newer',
      title: 'Newer generated task',
      dueDate: '2026-03-27',
      templateId,
    })
    mockGet.mockResolvedValue(jsonResponse([olderTask, newerTask]))

    const { container } = await renderGeneratedTasksList()
    await screen.findByText('Newer generated task')

    expect(generatedTasksListSnapshot(container)).toEqual({
      requests: [
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '0',
            },
          },
        ],
      ],
      taskIds: ['task-older', 'task-newer'],
    })
  })

  it('fetches the next page when the list sentinel intersects the viewport', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      makeTask({
        id: `task-${String(index)}`,
        number: index + 1,
        title: `Generated task ${String(index)}`,
        templateId,
      }),
    )
    const secondPage = [
      makeTask({
        id: 'task-next-page',
        number: firstPage.length + 1,
        title: 'Next page task',
        templateId,
      }),
    ]
    mockGet.mockImplementation(({ query }: { query: { offset: string } }) =>
      Promise.resolve(
        jsonResponse(query.offset === '0' ? firstPage : secondPage),
      ),
    )

    const { container } = await renderGeneratedTasksList()
    await screen.findByText('Generated task 0')
    const observer = MockIntersectionObserver.instances[0]
    if (observer == null) throw new Error('expected an IntersectionObserver')

    act(() => {
      observer.trigger(true)
    })
    await screen.findByText('Next page task')

    expect(generatedTasksListSnapshot(container)).toEqual({
      requests: [
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '0',
            },
          },
        ],
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '50',
            },
          },
        ],
      ],
      taskIds: [...firstPage, ...secondPage].map((task) => task.id),
    })
  })

  it('shows a next-page error and retries the request', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) =>
      makeTask({
        id: `task-${String(index)}`,
        number: index + 1,
        title: `Generated task ${String(index)}`,
        templateId,
      }),
    )
    const nextPage = [
      makeTask({
        id: 'task-next-page',
        number: firstPage.length + 1,
        title: 'Next page task',
        templateId,
      }),
    ]
    let nextPageAttempts = 0
    mockGet.mockImplementation(({ query }: { query: { offset: string } }) => {
      if (query.offset === '0') return Promise.resolve(jsonResponse(firstPage))
      nextPageAttempts += 1
      return nextPageAttempts === 1
        ? Promise.reject(new Error('page load failed'))
        : Promise.resolve(jsonResponse(nextPage))
    })

    const user = userEvent.setup()
    const { container } = await renderGeneratedTasksList()
    await screen.findByText('Generated task 0')
    const observer = MockIntersectionObserver.instances[0]
    if (observer == null) throw new Error('expected an IntersectionObserver')

    act(() => {
      observer.trigger(true)
    })
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText('Next page task')

    expect(generatedTasksListSnapshot(container)).toEqual({
      requests: [
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '0',
            },
          },
        ],
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '50',
            },
          },
        ],
        [
          {
            query: {
              view: 'row',
              context: 'all',
              status: 'all',
              templateId,
              sortBy: 'due',
              order: 'desc',
              limit: '50',
              offset: '50',
            },
          },
        ],
      ],
      taskIds: [...firstPage, ...nextPage].map((task) => task.id),
    })
  })
})
