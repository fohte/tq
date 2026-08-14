import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { BackLink } from '#components/ui/back-header-bar'

function BackLinkStory(props: React.ComponentProps<typeof BackLink>) {
  const rootRoute = createRootRoute({
    component: () => (
      <div className="flex h-10 w-96 items-center gap-2.5 border-b border-border px-3">
        <BackLink {...props} />
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
  title: 'UI/BackLink',
  component: BackLinkStory,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof BackLinkStory>

export default meta
type Story = StoryObj<typeof meta>

export const IconOnly: Story = {
  args: {
    to: '/',
    'aria-label': 'Back',
  },
}

export const WithLabel: Story = {
  args: {
    to: '/',
    children: 'Projects',
  },
}
