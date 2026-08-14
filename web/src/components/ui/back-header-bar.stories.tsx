import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { BackHeaderBar } from '#components/ui/back-header-bar'

function BackHeaderBarStory(props: React.ComponentProps<typeof BackHeaderBar>) {
  const rootRoute = createRootRoute({
    component: () => (
      <div className="w-96 border border-border">
        <BackHeaderBar {...props} />
      </div>
    ),
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return <RouterProvider router={router} />
}

const meta = {
  title: 'UI/BackHeaderBar',
  component: BackHeaderBarStory,
  tags: ['mobile-only'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BackHeaderBarStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    to: '/',
    children: 'Projects',
  },
}
