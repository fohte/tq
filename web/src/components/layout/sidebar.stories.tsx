import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Sidebar } from '@web/components/layout/sidebar'

function SidebarStory() {
  return (
    <div className="h-screen md:flex">
      <Sidebar />
    </div>
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
