import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, within } from 'storybook/test'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
import { atIndex } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
})

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
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
    const input = atIndex(inputs, 0)
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
