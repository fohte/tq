import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { RecurringTemplateMainContent } from '#components/recurring/recurring-template-detail-main'
import { makeRecurringTemplate } from '#components/recurring/recurring-template-test-fixtures'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
import { assertDefined, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    useTaskList: () => ({ data: [], isLoading: false, isError: false }),
  }
})

vi.mock('#hooks/use-recurring-templates', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('#hooks/use-recurring-templates')>()
  return {
    ...actual,
    useUpdateRecurringTemplate: vi.fn(),
  }
})

const mockUseUpdateRecurringTemplate = vi.mocked(useUpdateRecurringTemplate)

type UpdateRecurringTemplateResult = ReturnType<
  typeof useUpdateRecurringTemplate
>

const templateId = 'template-001'

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderMainContent(title = 'Write weekly report') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const template = makeRecurringTemplate({
    id: templateId,
    title,
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
  it('saves the trimmed title with its {date} placeholder after Enter', async () => {
    const mutate = vi.fn()
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    await renderMainContent('Write {date} report')

    await user.click(
      screen.getByRole('button', { name: 'Write {date} report' }),
    )
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  Review {date} report  ' } })
    await user.keyboard('{Enter}')

    expect(mutate.mock.calls).toEqual([
      [{ id: templateId, input: { title: 'Review {date} report' } }],
    ])
  })

  it('does not save when the title edit is canceled with Escape', async () => {
    const mutate = vi.fn()
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    await renderMainContent()

    await user.click(
      screen.getByRole('button', { name: 'Write weekly report' }),
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Changed title' },
    })
    await user.keyboard('{Escape}')

    expect(mutate.mock.calls).toEqual([])
  })

  it('does not save a title that is empty after trimming', async () => {
    const mutate = vi.fn()
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    await renderMainContent()

    await user.click(
      screen.getByRole('button', { name: 'Write weekly report' }),
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } })
    await user.keyboard('{Enter}')

    expect(mutate.mock.calls).toEqual([])
  })

  it('does not save an unchanged title', async () => {
    const mutate = vi.fn()
    mockUseUpdateRecurringTemplate.mockReturnValue(
      partialMutation<UpdateRecurringTemplateResult>({ mutate }),
    )
    const user = userEvent.setup()
    await renderMainContent()

    await user.click(
      screen.getByRole('button', { name: 'Write weekly report' }),
    )
    await user.keyboard('{Enter}')

    expect(mutate.mock.calls).toEqual([])
  })

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
