import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, fn, within } from 'storybook/test'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'

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

function ModalStory(props: React.ComponentProps<typeof GithubIssueLinkModal>) {
  return (
    <Providers>
      <GithubIssueLinkModal {...props} />
    </Providers>
  )
}

const meta = {
  title: 'Task/GithubIssueLinkModal',
  component: ModalStory,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="dark h-screen bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
    mode: 'create',
  },
} satisfies Meta<typeof ModalStory>

export default meta
type Story = StoryObj<typeof meta>

export const CreateTask: Story = {
  play: async ({ canvasElement, userEvent }) => {
    // Modal renders via portal, so query the entire document body
    const body = within(canvasElement.ownerDocument.body)

    const titles = await body.findAllByText('Create task from GitHub')
    await expect(titles.length).toBeGreaterThan(0)

    // Confirm button stays disabled until a URL has been resolved
    const createButtons = body.getAllByRole('button', { name: 'Create Task' })
    for (const btn of createButtons) {
      await expect(btn).toBeDisabled()
    }

    const inputs = body.getAllByPlaceholderText(
      'https://github.com/owner/repo/issues/123',
    )
    const input = inputs[0]
    if (input == null) throw new Error('URL input not found')
    await userEvent.type(input, 'https://github.com/fohte/tq/issues/1')

    const stillDisabled = body
      .getAllByRole('button', { name: 'Create Task' })
      .every((btn) => btn.hasAttribute('disabled'))
    await expect(stillDisabled).toBe(true)
  },
}

export const LinkExistingTask: Story = {
  args: {
    mode: 'link',
    taskId: '550e8400-e29b-41d4-a716-446655440000',
  },
}
