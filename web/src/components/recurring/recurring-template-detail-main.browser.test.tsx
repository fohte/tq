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

import { RecurringTemplateMainContent } from '#components/recurring/recurring-template-detail-main'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { assertDefined } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    useTaskList: () => ({ data: [], isLoading: false, isError: false }),
  }
})

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderMainContent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const template = makeRecurringTemplate({
    id: 'template-001',
    title: 'Write weekly report',
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <RecurringTemplateMainContent template={template} />,
  })
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  const recurringRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/recurring',
    component: () => null,
  })
  rootRoute.addChildren([tasksRoute, recurringRoute])
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

describe('RecurringTemplateMainContent', () => {
  it('opens the delete confirmation dialog after choosing delete… from the actions menu', async () => {
    const user = userEvent.setup()
    const { container } = await renderMainContent()

    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )
    await user.click(trigger)
    await user.click(await screen.findByText('delete…'))

    expect(await screen.findByText('Delete template')).toBeInTheDocument()
  })
})
