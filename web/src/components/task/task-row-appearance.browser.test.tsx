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
import { describe, expect, it, vi } from 'vitest'

import { makeBlockedByGithubRef } from '#components/task/github-link-test-fixtures'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTaskWaitSummary } from '#components/task/task-wait-test-fixtures'
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

  it('renders checklist progress after the subtask count', async () => {
    const { container } = await renderTaskRow(
      makeTask({
        childCompletionCount: { completed: 2, total: 5 },
        checklistCompletionCount: { completed: 1, total: 4 },
      }),
    )

    expect(
      [
        ...container.querySelectorAll(
          '[data-testid="child-completion"], [data-testid="checklist-completion"]',
        ),
      ].map((element) => element.textContent),
    ).toEqual(['2/5', '1/4'])
  })

  it('hides checklist progress when the task has no checklist items', async () => {
    await renderTaskRow(makeTask())

    expect(screen.queryByTestId('checklist-completion')).toEqual(null)
  })

  it('opens a sole GitHub blocker without navigating away from the task row', async () => {
    const blockerRef = makeBlockedByGithubRef()
    const blockedTask = makeTask({ blockedByGithubRefs: [blockerRef] })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    const user = userEvent.setup()
    const { router } = await renderTaskRow(blockedTask)

    await user.click(
      screen.getByRole('button', {
        name: 'Open example-team/sample-project#2048 on GitHub',
      }),
    )

    const readActual = () => ({
      openCalls: openSpy.mock.calls,
      location: router.state.location.pathname,
    })

    expect(readActual()).toEqual({
      openCalls: [[blockerRef.url, '_blank', 'noopener,noreferrer']],
      location: '/',
    })
  })

  it('highlights an overdue reply wait in the task row', async () => {
    const { container } = await renderTaskRow(
      makeTask({
        waits: [
          makeTaskWaitSummary({
            label: 'Review feedback',
            followUpDate: '2000-01-01',
          }),
        ],
      }),
    )
    const followUpDate = screen.getByText('Jan 1, 2000')

    const readActual = () => ({
      badgeText: followUpDate.parentElement?.parentElement?.textContent,
      dateIsPrimary: followUpDate.classList.contains('text-primary'),
      hourglassCount: container.querySelectorAll('svg.lucide-hourglass').length,
    })

    expect(readActual()).toEqual({
      badgeText: 'personal·Review feedback·follow upJan 1, 2000',
      dateIsPrimary: true,
      hourglassCount: 1,
    })
  })

  it('counts unresolved reply waits with task and GitHub blockers', async () => {
    await renderTaskRow(
      makeTask({
        blockedByNumbers: [312],
        blockedByGithubRefs: [makeBlockedByGithubRef()],
        waits: [makeTaskWaitSummary()],
      }),
    )

    expect(screen.getByText('blocked by 3').textContent).toEqual('blocked by 3')
  })
})
