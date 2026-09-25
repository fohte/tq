import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppLayout } from '#components/layout/app-layout'
import {
  TaskMainContent,
  TaskSidebarMobile,
} from '#components/task/task-detail'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { labelKeys } from '#hooks/use-labels'
import { projectKeys } from '#hooks/use-projects'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { savedViewKeys } from '#hooks/use-saved-views'
import { activityKeys } from '#hooks/use-task-activity'
import { commentKeys } from '#hooks/use-task-comments'
import type { TaskDetail } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined, focusDescriptionEditor } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

// AppLayout mounts Sidebar/StatusLine, and this test also mounts
// TaskSidebarMobile — both read queries beyond TaskMainContent's own.
function seedAppLayoutQueries(queryClient: QueryClient, task: TaskDetail) {
  // Matches useCurrentContext's default (no session-open-settings written yet).
  const context = 'personal'
  const todayStr = formatLocalDate(new Date())

  queryClient.setQueryData(commentKeys.all(task.id), [])
  queryClient.setQueryData(activityKeys.all(task.id), [])
  queryClient.setQueryData(taskKeys.list(undefined), [])
  queryClient.setQueryData(taskKeys.list({ context }), [])
  queryClient.setQueryData(
    taskKeys.list({ context, commitment: 'inbox', status: 'todo' }),
    [],
  )
  queryClient.setQueryData(labelKeys.list({ context }), [])
  queryClient.setQueryData(projectKeys.list(undefined), [])
  queryClient.setQueryData(projectKeys.list({ context }), [])
  queryClient.setQueryData(savedViewKeys.list({ context }), [])
  // TaskSidebarMobile's SidebarPlanField reads both via useTaskPlan.
  queryClient.setQueryData(queueKeys.items(DAY_QUEUE_KEY, todayStr), [])
  queryClient.setQueryData(queueKeys.items(WEEK_QUEUE_KEY, todayStr), [])
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderMobileTaskDetail(task: TaskDetail) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  seedAppLayoutQueries(queryClient, task)

  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <AppLayout>
        <div className="flex h-full flex-col overflow-y-auto p-4">
          <TaskSidebarMobile task={task} />
          <div className="mt-4 border-t border-border pt-4">
            <TaskMainContent
              task={task}
              pages={[]}
              subtasks={[]}
              sessions={[]}
            />
          </div>
        </div>
      </AppLayout>
    ),
  })
  // Registered so Sidebar/BottomTabBar Links to these paths resolve, mirroring
  // task-main-content.stories.tsx's Providers.
  const childPaths = [
    '/tasks',
    '/tasks/$taskId',
    '/tasks/$taskId/pages/$pageId',
  ]
  rootRoute.addChildren(
    childPaths.map((path) =>
      createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: () => null,
      }),
    ),
  )
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

function shrinkVisualViewportForKeyboard(height: number) {
  const visualViewport = assertDefined(
    window.visualViewport,
    'browsers used for these tests always provide visualViewport',
  )
  vi.spyOn(visualViewport, 'height', 'get').mockReturnValue(height)
  visualViewport.dispatchEvent(new Event('resize'))
  return visualViewport
}

afterEach(() => {
  vi.restoreAllMocks()
})

// Regression checks: the fix lives in AppLayout's own root element, which is
// why these render through the real AppLayout rather than a standalone mimic.
describe('TaskMainContent on mobile with the on-screen keyboard open', () => {
  it('does not scroll the window while typing', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    const { container } = await renderMobileTaskDetail(makeTaskDetail())

    await focusDescriptionEditor(user, container)
    shrinkVisualViewportForKeyboard(200)
    const scrollBySpy = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => {})

    await user.keyboard('!')

    expect(scrollBySpy).not.toHaveBeenCalled()
  })

  it('keeps the caret above the shrunk viewport while typing many lines', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    const { container } = await renderMobileTaskDetail(makeTaskDetail())

    await focusDescriptionEditor(user, container)
    const visualViewport = shrinkVisualViewportForKeyboard(200)

    // A character follows each newline: a collapsed range at an empty line
    // reports an empty (all-zero) bounding rect in Chromium.
    await user.keyboard('{Enter}x'.repeat(30))

    const selection = assertDefined(
      window.getSelection(),
      'a focused contenteditable always has an active selection',
    )
    const caretRect = selection.getRangeAt(0).getBoundingClientRect()

    expect(caretRect.bottom).toBeLessThanOrEqual(visualViewport.height)
  })
})
