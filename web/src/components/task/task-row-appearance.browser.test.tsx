import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'

const task: Task = makeTask()

const recurringTask: Task = makeTask({
  title: 'Water the plants',
  recurrenceRule: {
    id: 'recurrence-1',
    type: 'weekly',
    interval: 1,
    daysOfWeek: [0, 3],
    dayOfMonth: null,
  },
  templateId: '00000000-0000-0000-0000-000000000002',
})

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderTaskRow(task: Task) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <TaskRowAppearance task={task} />,
  })
  // The row itself navigates to /tasks/$taskId and the recurrence chip to
  // /recurring/$templateId, so both must be registered to resolve instead of
  // erroring on an unmatched route.
  const taskDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  const recurringRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recurring/$templateId',
    component: () => null,
  })
  rootRoute.addChildren([taskDetailRoute, recurringRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    router,
  }
}

describe('TaskRowAppearance', () => {
  it('navigates to the task detail page when the row is clicked', async () => {
    const user = userEvent.setup()
    const { router } = await renderTaskRow(task)

    await user.click(screen.getByText('Task title'))

    expect(router.state.location.pathname).toBe(`/tasks/${task.id}`)
  })

  it('navigates to the recurring template when the recurrence chip is clicked', async () => {
    const user = userEvent.setup()
    const { router } = await renderTaskRow(recurringTask)

    await user.click(screen.getByText('Weekly · Sun, Wed'))

    expect(router.state.location.pathname).toBe(
      '/recurring/00000000-0000-0000-0000-000000000002',
    )
  })
})
