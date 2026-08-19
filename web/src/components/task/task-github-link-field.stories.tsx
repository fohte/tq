import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { SidebarGithubLinkField } from '#components/task/task-github-link-field'
import type { GithubLink } from '#hooks/use-github-link'
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
