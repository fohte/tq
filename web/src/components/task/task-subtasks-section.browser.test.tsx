import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { makeTask } from '#components/task/task-row-test-fixtures'
import type { InheritedTaskAttributes } from '#components/task/task-subtasks-section'
import { TaskSubtasksList } from '#components/task/task-subtasks-section'
import type { Task } from '#hooks/use-tasks'
import { assertDefined } from '#lib/test-utils'

const parentTaskId = '00000000-0000-0000-0000-000000000001'

const subtask: Task = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 11,
  title: 'Sketch wireframes',
  context: 'work',
  parentId: parentTaskId,
  parentNumber: 1,
})

// TaskRowAppearance links each subtask to its detail page, so rendering the
// list requires a router — mirrors tree-task-grid-row.browser.test.tsx's
// renderTree helper.
async function renderSection(inherited: InheritedTaskAttributes) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <TaskSubtasksList
        taskId={parentTaskId}
        parentTaskNumber={1}
        parentTaskTitle="Design the new dashboard"
        subtasks={[subtask]}
        inherited={inherited}
      />
    ),
  })
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

describe('TaskSubtasksList', () => {
  it('opens the create-task modal pre-filled with the parent and inherited attributes when "add subtask" is clicked', async () => {
    const user = userEvent.setup()
    await renderSection({
      context: 'work',
      projectId: 'aaaa0000-0000-0000-0000-000000000000',
      labels: ['dev:tq'],
    })

    await user.click(screen.getByRole('button', { name: /add subtask/i }))

    // The modal renders via a portal to document.body, not inside the
    // section's own container.
    const body = within(document.body)
    expect(
      (await body.findAllByPlaceholderText(/task title|タスクのタイトル/i))
        .length,
    ).toBeGreaterThan(0)

    // Parent indicator shows the subtask-of task.
    expect(
      body.getAllByText(/subtask of #1 Design the new dashboard/).length,
    ).toBeGreaterThan(0)

    // Opening registers the inherited option, so verify that Work is selected.
    const contextField = assertDefined(
      body.getByText('Context', { exact: true }).parentElement,
    )
    const contextTrigger = within(contextField).getByRole('combobox')
    await user.click(contextTrigger)
    const workOption = await body.findByRole('option', { name: 'Work' })
    expect(workOption.getAttribute('aria-selected')).toEqual('true')

    // Inherited label lands as a tag chip.
    expect(body.getAllByText(/dev:tq/).length).toBeGreaterThan(0)
  })
})
