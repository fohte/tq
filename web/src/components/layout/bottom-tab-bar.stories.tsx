import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { BottomTabBar } from '@web/components/layout/bottom-tab-bar'

function BottomTabBarStory() {
  return (
    <div className="relative h-20">
      <BottomTabBar />
    </div>
  )
}

function BottomTabBarWithRouter({ currentPath }: { currentPath: string }) {
  const rootRoute = createRootRoute({ component: BottomTabBarStory })
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
  title: 'Layout/BottomTabBar',
  component: BottomTabBarWithRouter,
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/projects', '/today'],
    },
  },
} satisfies Meta<typeof BottomTabBarWithRouter>

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
