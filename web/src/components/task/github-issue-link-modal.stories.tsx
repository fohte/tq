import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { GithubIssueLinkModal } from '#components/task/github-issue-link-modal'
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
    taskId: '550e8400-e29b-41d4-a716-446655440000',
  },
} satisfies Meta<typeof ModalStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
