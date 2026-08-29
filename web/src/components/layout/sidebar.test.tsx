import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '#components/layout/sidebar'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
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

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const tasksWithTags: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] },
  { ...baseTask, id: '2', title: 'Task B', labels: ['dev:tq'] },
]

const baseProject: Project = {
  id: '00000000-0000-0000-0000-000000000101',
  title: 'tq',
  description: null,
  status: 'active',
  startDate: null,
  targetDate: null,
  color: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  completionRate: 0,
  taskCount: { total: 0, completed: 0 },
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderSidebar(
  tasks: Task[] = [],
  projects: Project[] = [],
  initialEntry = '/',
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(projectKeys.list(undefined), projects)

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

  describe('TagsSection', () => {
    it('shows each tag with its name and count', async () => {
      await renderSidebar(tasksWithTags)

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      const urgentLink = screen.getByRole('link', { name: /urgent/ })
      expect(devTqLink).toHaveTextContent('#dev:tq2')
      expect(urgentLink).toHaveTextContent('#urgent1')
    })

    it('links each tag to /tasks scoped to that tag, replacing the query', async () => {
      await renderSidebar(tasksWithTags)

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      expect(devTqLink).toHaveAttribute('href', '/tasks')
      expect(devTqLink.dataset['search']).toBe(
        JSON.stringify({
          q: 'is:todo is:in_progress label:dev:tq sort:updated',
        }),
      )
    })

    it('does not highlight any tag when the current query has none', async () => {
      await renderSidebar(tasksWithTags)
      expect(screen.getByRole('link', { name: /dev:tq/ })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('highlights the tag matching the current query, derived from it', async () => {
      await renderSidebar(tasksWithTags, [], '/?q=label:dev:tq')

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
      await renderSidebar(
        [],
        [
          {
            ...baseProject,
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 3, total: 10 },
          },
        ],
      )

      expect(
        screen.getByRole('link', { name: /Project Alpha/ }),
      ).toHaveTextContent('Project Alpha3/10')
    })

    it('shows both active and paused projects together', async () => {
      await renderSidebar(
        [],
        [
          {
            ...baseProject,
            id: '1',
            title: 'Project Alpha',
            status: 'active',
            taskCount: { completed: 1, total: 2 },
          },
          {
            ...baseProject,
            id: '2',
            title: 'Project Beta',
            status: 'paused',
            taskCount: { completed: 5, total: 5 },
          },
        ],
      )

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
