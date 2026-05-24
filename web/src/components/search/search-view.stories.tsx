import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { SearchViewInner } from '@web/components/search/search-view'
import type { SearchResult } from '@web/hooks/use-search'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

const baseTask: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const mockResults: SearchResult[] = [
  {
    ...baseTask,
    id: '1',
    title: 'Deploy to production',
    context: 'work',
    estimatedMinutes: 120,
  },
  {
    ...baseTask,
    id: '2',
    title: 'Fix armyknife build',
    context: 'dev',
    estimatedMinutes: 90,
    status: 'in_progress',
  },
  {
    ...baseTask,
    id: '3',
    title: 'Write API documentation',
    estimatedMinutes: 60,
  },
  {
    ...baseTask,
    id: '4',
    title: 'Review pull request',
    status: 'completed',
    estimatedMinutes: 30,
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Search/SearchView',
  component: SearchViewInner,
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    query: '',
    setQuery: fn(),
    filters: {},
    results: [],
    isFetching: false,
    hasQuery: false,
    updateFilter: fn(),
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="h-[844px] w-[390px] bg-background">
          <Story />
        </div>
      </Providers>
    ),
  ],
} satisfies Meta<typeof SearchViewInner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    onBack: fn(),
  },
}

export const WithResults: Story = {
  args: {
    query: 'armyknife',
    hasQuery: true,
    results: mockResults,
    onBack: fn(),
  },
}

export const WithFilters: Story = {
  args: {
    query: 'is:todo context:work',
    hasQuery: true,
    filters: { status: 'todo', context: 'work' },
    results: mockResults.slice(0, 1),
    onBack: fn(),
  },
}

export const Loading: Story = {
  args: {
    query: 'searching...',
    hasQuery: true,
    isFetching: true,
    onBack: fn(),
  },
}

export const NoResults: Story = {
  args: {
    query: 'nonexistent',
    hasQuery: true,
    results: [],
    onBack: fn(),
  },
}

export const NoBackButton: Story = {
  args: {},
}
