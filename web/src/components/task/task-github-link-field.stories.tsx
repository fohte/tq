import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { SidebarGithubLinkField } from '#components/task/task-github-link-field'
import type { GithubLink } from '#hooks/use-github-link'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Providers({ children }: { children: React.ReactNode }) {
  const rootRoute = createRootRoute({ component: () => <>{children}</> })
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

function FieldStory(
  props: React.ComponentProps<typeof SidebarGithubLinkField>,
) {
  return (
    <Providers>
      <SidebarGithubLinkField {...props} />
    </Providers>
  )
}

const sampleLink: GithubLink = {
  id: 'link-1',
  owner: 'fohte',
  repo: 'tq',
  number: 42,
  kind: 'issue',
  url: 'https://github.com/fohte/tq/issues/42',
  state: 'open',
  title: 'Sample issue',
  lastSyncedAt: '2026-03-20T00:00:00.000Z',
}

const meta = {
  title: 'Task/SidebarGithubLinkField',
  component: FieldStory,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="dark w-60 bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    taskId: '550e8400-e29b-41d4-a716-446655440000',
  },
} satisfies Meta<typeof FieldStory>

export default meta
type Story = StoryObj<typeof meta>

export const Unlinked: Story = {
  args: {
    githubLink: null,
  },
}

export const Linked: Story = {
  args: {
    githubLink: sampleLink,
  },
}
