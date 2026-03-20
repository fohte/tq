import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { AppLayout } from '@web/components/layout/app-layout'

function AppLayoutStory() {
  return (
    <AppLayout>
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Page Content
      </div>
    </AppLayout>
  )
}

function AppLayoutWithRouter({ currentPath }: { currentPath: string }) {
  const rootRoute = createRootRoute({ component: AppLayoutStory })
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
  title: 'Layout/AppLayout',
  component: AppLayoutWithRouter,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/search', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof AppLayoutWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksPage: Story = {
  args: {
    currentPath: '/tasks',
  },
}
