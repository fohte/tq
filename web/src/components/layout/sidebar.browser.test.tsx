import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Sidebar } from '#components/layout/sidebar'
import {
  makeLabel,
  makeProject,
  makeSavedView,
} from '#components/layout/sidebar-test-fixtures'
import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import type { Label } from '#hooks/use-labels'
import type { Project } from '#hooks/use-projects'
import { projectKeys } from '#hooks/use-projects'
import type { SavedView } from '#hooks/use-saved-views'
import { labelKeys, savedViewKeys, taskKeys } from '#lib/query-keys'
import type { TagCount } from '#lib/tag-tree'
import { makeTagCount } from '#lib/tag-tree-test-fixtures'
import { assertDefined } from '#lib/test-utils'

// Only Link/useMatchRoute are stubbed — useSearch stays real so the
// VIEWS/TAGS sections' active-item derivation keeps working. The stub
// exposes `to` as href and `search` as a data attribute so tests can
// assert on the link target without a real router matching it.
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

const tagCountsWithTags: TagCount[] = [
  makeTagCount({ name: 'dev:tq', count: 2 }),
  makeTagCount({ name: 'urgent', count: 1 }),
]

const labelsForTasksWithTags: Label[] = [
  makeLabel({ id: '1', name: 'dev:tq' }),
  makeLabel({ id: '2', name: 'urgent' }),
]

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderSidebar({
  tagCounts = [],
  projects = [],
  initialEntry = '/',
  savedViews = [],
  labels = [],
  pendingTagCounts = false,
}: {
  tagCounts?: TagCount[]
  projects?: Project[]
  initialEntry?: string
  savedViews?: SavedView[]
  labels?: Label[]
  pendingTagCounts?: boolean
} = {}) {
  resetSessionOpenSettings({ localContext: 'personal' })

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  let resolveTagCounts: (counts: TagCount[]) => void = () => {}
  let pendingTagCountsRequest: Promise<TagCount[]> | undefined
  if (pendingTagCounts) {
    const request = new Promise<TagCount[]>((resolve) => {
      resolveTagCounts = resolve
    })
    pendingTagCountsRequest = queryClient.fetchQuery({
      queryKey: taskKeys.labelCounts('personal'),
      queryFn: () => request,
    })
  } else {
    queryClient.setQueryData(taskKeys.labelCounts('personal'), tagCounts)
  }
  queryClient.setQueryData(
    projectKeys.list({ context: 'personal', status: 'all' }),
    projects,
  )
  queryClient.setQueryData(
    savedViewKeys.list({ context: 'personal' }),
    savedViews,
  )
  queryClient.setQueryData(labelKeys.list({ context: 'personal' }), labels)

  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => <Sidebar />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()

  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    ),
    resolveTagCounts,
    pendingTagCountsRequest,
  }
}

function readBreakpointVisibility(sidebar: HTMLElement) {
  return {
    hiddenBelowMd: sidebar.classList.contains('hidden'),
    visibleAtMd: sidebar.classList.contains('md:flex'),
  }
}

describe('Sidebar', () => {
  it('is hidden below the md breakpoint', async () => {
    await renderSidebar()
    const sidebar = screen.getByRole('complementary')
    expect(readBreakpointVisibility(sidebar)).toEqual({
      hiddenBelowMd: true,
      visibleAtMd: true,
    })
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

    it('opens the actions menu with edit/delete items on trigger click', async () => {
      const user = userEvent.setup()
      const { container } = await renderSidebar({ savedViews: views })
      const trigger = assertDefined(
        container.querySelector<HTMLElement>(
          '[data-slot="dropdown-menu-trigger"][aria-label="View actions"]',
        ),
        'desktop trigger not found',
      )

      await user.click(trigger)

      expect(await screen.findByText('rename…')).toBeInTheDocument()
      expect(screen.getByText('delete…')).toBeInTheDocument()
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
    function getTagSectionState() {
      return {
        tags: screen
          .queryAllByRole('link', { name: /^#/ })
          .map((link) => link.textContent),
        toggle:
          screen.queryByRole('button', {
            name: /See all tags|Hide orphan tags/,
          })?.textContent ?? null,
      }
    }

    function getDeleteDialogState() {
      return {
        title: screen.getByRole('heading', { name: 'Delete tag' }).textContent,
        description: screen.getByText(
          'Are you sure you want to delete "#orphan"? This action cannot be undone.',
        ).textContent,
        buttons: within(screen.getByRole('dialog'))
          .getAllByRole('button')
          .map((button) => button.textContent),
      }
    }

    it('hides orphan tags by default and toggles them into the tree', async () => {
      const user = userEvent.setup()
      const labels = [
        ...labelsForTasksWithTags,
        makeLabel({ id: '3', name: 'orphan' }),
      ]
      await renderSidebar({ tagCounts: tagCountsWithTags, labels })

      const states = [getTagSectionState()]
      await user.click(screen.getByRole('button', { name: 'See all tags' }))
      states.push(getTagSectionState())
      await user.click(screen.getByRole('button', { name: 'Hide orphan tags' }))
      states.push(getTagSectionState())

      expect(states).toEqual([
        { tags: ['#dev:tq2', '#urgent1'], toggle: 'See all tags' },
        {
          tags: ['#dev:tq2', '#urgent1', '#orphan0'],
          toggle: 'Hide orphan tags',
        },
        { tags: ['#dev:tq2', '#urgent1'], toggle: 'See all tags' },
      ])
    })

    it('waits for tag counts before showing the orphan toggle', async () => {
      const labels = [
        makeLabel({ id: '1', name: 'assigned' }),
        makeLabel({ id: '2', name: 'orphan' }),
      ]
      const { resolveTagCounts, pendingTagCountsRequest } = await renderSidebar(
        {
          labels,
          pendingTagCounts: true,
        },
      )
      const states = [getTagSectionState()]

      await act(async () => {
        resolveTagCounts([makeTagCount({ name: 'assigned', count: 1 })])
        await assertDefined(
          pendingTagCountsRequest,
          'tag counts request missing',
        )
      })
      states.push(getTagSectionState())

      expect(states).toEqual([
        { tags: [], toggle: null },
        { tags: ['#assigned1'], toggle: 'See all tags' },
      ])
    })

    it('keeps a completed-only tag visible without showing the orphan toggle', async () => {
      await renderSidebar({
        tagCounts: [makeTagCount({ name: 'finished' })],
        labels: [makeLabel({ id: '1', name: 'finished' })],
      })

      expect(getTagSectionState()).toEqual({
        tags: ['#finished0'],
        toggle: null,
      })
    })

    it('lets an orphan tag open its existing delete confirmation', async () => {
      const user = userEvent.setup()
      const { container } = await renderSidebar({
        labels: [makeLabel({ id: '3', name: 'orphan' })],
      })
      await user.click(screen.getByRole('button', { name: 'See all tags' }))
      const trigger = assertDefined(
        container.querySelector<HTMLElement>(
          '[data-slot="dropdown-menu-trigger"][aria-label="Tag actions"]',
        ),
        'desktop trigger not found',
      )

      await user.click(trigger)
      await user.click(await screen.findByText('delete…'))

      expect(getDeleteDialogState()).toEqual({
        title: 'Delete tag',
        description:
          'Are you sure you want to delete "#orphan"? This action cannot be undone.',
        buttons: ['Cancel', 'Delete', 'Close'],
      })
    })

    it('shows each tag with its name and count', async () => {
      await renderSidebar({
        tagCounts: tagCountsWithTags,
        labels: labelsForTasksWithTags,
      })

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      const urgentLink = screen.getByRole('link', { name: /urgent/ })
      expect(devTqLink).toHaveTextContent('#dev:tq2')
      expect(urgentLink).toHaveTextContent('#urgent1')
    })

    it('links each tag to /tasks scoped to that tag, replacing the query', async () => {
      await renderSidebar({
        tagCounts: tagCountsWithTags,
        labels: labelsForTasksWithTags,
      })

      const devTqLink = screen.getByRole('link', { name: /dev:tq/ })
      expect(devTqLink).toHaveAttribute('href', '/tasks')
      expect(devTqLink.dataset['search']).toBe(
        JSON.stringify({
          q: 'is:todo label:dev:tq sort:updated',
        }),
      )
    })

    it('does not highlight any tag when the current query has none', async () => {
      await renderSidebar({
        tagCounts: tagCountsWithTags,
        labels: labelsForTasksWithTags,
      })
      expect(screen.getByRole('link', { name: /dev:tq/ })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('highlights the tag matching the current query, derived from it', async () => {
      await renderSidebar({
        tagCounts: tagCountsWithTags,
        labels: labelsForTasksWithTags,
        initialEntry: '/?q=label:dev:tq',
      })

      expect(screen.getByRole('link', { name: /dev:tq/ })).toHaveClass(
        'bg-card',
      )
      expect(screen.getByRole('link', { name: /urgent/ })).toHaveClass(
        'text-muted-foreground-strong',
      )
    })

    it('opens the actions menu with edit/delete items on trigger click', async () => {
      const user = userEvent.setup()
      const { container } = await renderSidebar({
        tagCounts: tagCountsWithTags,
        labels: labelsForTasksWithTags,
      })
      const trigger = assertDefined(
        container.querySelector<HTMLElement>(
          '[data-slot="dropdown-menu-trigger"][aria-label="Tag actions"]',
        ),
        'desktop trigger not found',
      )

      await user.click(trigger)

      expect(await screen.findByText('edit…')).toBeInTheDocument()
      expect(screen.getByText('delete…')).toBeInTheDocument()
    })

    describe('with a "/"-separated tag hierarchy', () => {
      const nestedTagCounts: TagCount[] = [
        makeTagCount({ name: 'dev', count: 2 }),
        makeTagCount({ name: 'dev/tq', count: 1 }),
        makeTagCount({ name: 'dev/infra', count: 1 }),
      ]
      const nestedLabels: Label[] = [
        makeLabel({ id: '10', name: 'dev/tq' }),
        makeLabel({ id: '11', name: 'dev/infra' }),
      ]

      it('renders the tree returned by useTagCounts as nested rows, parent above children', async () => {
        await renderSidebar({
          tagCounts: nestedTagCounts,
          labels: nestedLabels,
        })

        const links = screen.getAllByRole('link', { name: /^#/ })
        expect(links.map((link) => link.textContent)).toEqual([
          '#dev2',
          '#infra1',
          '#tq1',
        ])
      })

      it('shows a nested tag by its last path segment only, not its full name', async () => {
        await renderSidebar({
          tagCounts: nestedTagCounts,
          labels: nestedLabels,
        })

        expect(screen.getByRole('link', { name: '# tq 1' })).toBeInTheDocument()
      })

      it('links a synthesized parent to /tasks scoped to its own name', async () => {
        await renderSidebar({
          tagCounts: nestedTagCounts,
          labels: nestedLabels,
        })

        const devLink = screen.getByRole('link', { name: /dev/ })
        expect(devLink).toHaveAttribute('href', '/tasks')
        expect(devLink.dataset['search']).toBe(
          JSON.stringify({ q: 'is:todo label:dev sort:updated' }),
        )
      })

      it('does not offer edit/delete actions for a synthesized parent', async () => {
        await renderSidebar({
          tagCounts: nestedTagCounts,
          labels: nestedLabels,
        })

        const devLink = screen.getByRole('link', { name: /dev/ })
        expect(within(devLink).queryAllByRole('button')).toHaveLength(0)
      })
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
