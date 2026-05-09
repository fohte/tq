import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Sidebar } from '@web/components/layout/sidebar'
import { fn } from 'storybook/test'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

function SidebarStory() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen md:flex">
        <Sidebar onNewProject={fn()} />
      </div>
    </QueryClientProvider>
  )
}

function SidebarWithRouter({ currentPath }: { currentPath: string }) {
  const rootRoute = createRootRoute({ component: SidebarStory })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [currentPath] }),
  })

  return <RouterProvider router={router} />
}

const meta = {
  title: 'Layout/Sidebar',
  component: SidebarWithRouter,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/search', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof SidebarWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksActive: Story = {
  args: {
    currentPath: '/tasks',
  },
}

export const SearchActive: Story = {
  args: {
    currentPath: '/search',
  },
}

export const ProjectsActive: Story = {
  args: {
    currentPath: '/projects',
  },
}
