import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '#components/layout/sidebar'
import {
  makeProject,
  makeSavedView,
  makeTask,
} from '#components/layout/sidebar-test-fixtures'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { savedViewKeys } from '#hooks/use-saved-views'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'

// Only Link/useMatchRoute are stubbed — useSearch/router-building exports
// stay real so useContextFilter (via useSearch({strict: false})) and the
// TAGS section's active-tag derivation keep working. The stub exposes `to`
// as href and `search` as a data attribute so tests can assert on the link
// target without a real router matching it.
vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      children,
      to,
      search,
      ...props
    }: {
      children: React.ReactNode
      to?: string
      search?: Record<string, unknown>
    } & Record<string, unknown>) => (
      <a
        href={typeof to === 'string' ? to : '#'}
        data-search={search != null ? JSON.stringify(search) : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    useMatchRoute: () => () => false,
  }
})

const tasksWithTags: Task[] = [
  makeTask({ id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] }),
  makeTask({ id: '2', title: 'Task B', labels: ['dev:tq'] }),
]

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderSidebar({
  tasks = [],
  projects = [],
  initialEntry = '/',
  savedViews = [],
}: {
  tasks?: Task[]
  projects?: Project[]
  initialEntry?: string
  savedViews?: SavedView[]
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(projectKeys.list(undefined), projects)
  queryClient.setQueryData(savedViewKeys.list(), savedViews)

  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <Sidebar />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

describe('Sidebar', () => {
  it('is hidden below the md breakpoint', async () => {
    await renderSidebar()
    expect(screen.getByRole('complementary').className).toBe(
      'hidden h-screen w-50 shrink-0 flex-col border-r border-border bg-sidebar md:flex',
    )
  })

  describe('ViewsSection', () => {
    const views: SavedView[] = [
      makeSavedView({ id: '1', name: 'Now', query: 'commitment:active' }),
      makeSavedView({ id: '2', name: 'Someday', query: 'commitment:someday' }),
    ]

    it('shows each saved view by name', async () => {
      await renderSidebar({ savedViews: views })

      expect(screen.getByRole('link', { name: 'Now' })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Someday' })).toBeInTheDocument()
    })

    it('links each view to /tasks with its saved query', async () => {
      await renderSidebar({ savedViews: views })

      const nowLink = screen.getByRole('link', { name: 'Now' })
      expect(nowLink).toHaveAttribute('href', '/tasks')
      expect(nowLink.dataset['search']).toBe(
        JSON.stringify({ q: 'commitment:active' }),
      )
    })

    it('does not highlight any view when the current query has none', async () => {
      await renderSidebar({ savedViews: views })

      expect(screen.getByRole('link', { name: 'Now' })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('highlights the view whose saved query matches the current query', async () => {
      await renderSidebar({
        initialEntry: '/?q=commitment:active',
        savedViews: views,
      })

      expect(screen.getByRole('link', { name: 'Now' })).toHaveClass('bg-card')
      expect(screen.getByRole('link', { name: 'Someday' })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('does not render the section when there are no saved views', async () => {
      await renderSidebar()

      expect(screen.queryByText('VIEWS')).not.toBeInTheDocument()
    })

    describe('with more than 5 views', () => {
      const manyViews = Array.from({ length: 7 }, (_, i) =>
        makeSavedView({
          id: String(i + 1),
          name: `View ${String(i + 1)}`,
          query: `commitment:active label:view-${String(i + 1)}`,
        }),
      )

      it('shows only the first 5, with a "+ N more" button', async () => {
        await renderSidebar({ savedViews: manyViews })

        expect(screen.getAllByRole('link', { name: /^View \d$/ })).toHaveLength(
          5,
        )
        expect(
          screen.getByRole('button', { name: '+ 2 more' }),
        ).toBeInTheDocument()
      })

      it('reveals the rest and hides the button on click', async () => {
        await renderSidebar({ savedViews: manyViews })

        await userEvent.click(screen.getByRole('button', { name: '+ 2 more' }))

        expect(screen.getAllByRole('link', { name: /^View \d$/ })).toHaveLength(
          7,
        )
        expect(
          screen.queryByRole('button', { name: '+ 2 more' }),
        ).not.toBeInTheDocument()
      })
    })
  })

  describe('TagsSection', () => {
    it('shows each tag with its name and count', async () => {
      await renderSidebar({ tasks: tasksWithTags })

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      const urgentLink = screen.getByRole('link', { name: /urgent/ })
      expect(devTqLink).toHaveTextContent('#dev:tq2')
      expect(urgentLink).toHaveTextContent('#urgent1')
    })

    it('links each tag to /tasks scoped to that tag, replacing the query', async () => {
      await renderSidebar({ tasks: tasksWithTags })

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      expect(devTqLink).toHaveAttribute('href', '/tasks')
      expect(devTqLink.dataset['search']).toBe(
        JSON.stringify({
          q: 'is:todo label:dev:tq sort:updated',
        }),
      )
    })

    it('does not highlight any tag when the current query has none', async () => {
      await renderSidebar({ tasks: tasksWithTags })
      expect(screen.getByRole('link', { name: /dev:tq/ })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('highlights the tag matching the current query, derived from it', async () => {
      await renderSidebar({
        tasks: tasksWithTags,
        initialEntry: '/?q=label:dev:tq',
      })

      expect(screen.getByRole('link', { name: /dev:tq/ })).toHaveClass(
        'bg-card',
      )
      expect(screen.getByRole('link', { name: /urgent/ })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })
  })

  describe('ProjectsSection', () => {
    it("shows a project's completed/total ratio", async () => {
      await renderSidebar({
        projects: [
          makeProject({
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 3, total: 10 },
          }),
        ],
      })

      expect(
        screen.getByRole('link', { name: /Project Alpha/ }),
      ).toHaveTextContent('Project Alpha3/10')
    })

    it('shows both active and paused projects together', async () => {
      await renderSidebar({
        projects: [
          makeProject({
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 1, total: 2 },
          }),
          makeProject({
            id: '2',
            title: 'Project Beta',
            status: 'paused',
            taskCount: { completed: 5, total: 5 },
          }),
        ],
      })

      const projectLinks = screen.getAllByRole('link', {
        name: /^Project (Alpha|Beta)/,
      })
      expect(projectLinks.map((link) => link.textContent)).toEqual([
        'Project Alpha1/2',
        'Project Beta5/5',
      ])
    })
  })
})
