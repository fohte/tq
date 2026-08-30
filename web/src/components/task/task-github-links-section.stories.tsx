import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskGithubLinksSection } from '#components/task/task-github-links-section'
import type { GithubLink } from '#hooks/use-github-link'
import { StoryRouter } from '#storybook-config/story-router'

const taskId = '00000000-0000-0000-0000-000000000001'

const baseLink: GithubLink = {
  id: 'link-1',
  owner: 'fohte',
  repo: 'tq',
  number: 412,
  kind: 'issue',
  url: 'https://github.com/fohte/tq/issues/412',
  state: 'open',
  title: 'Support associating multiple GitHub links with a task',
  lastSyncedAt: '2026-03-20T00:00:00.000Z',
}

const mixedLinks: GithubLink[] = [
  baseLink,
  {
    ...baseLink,
    id: 'link-2',
    number: 436,
    kind: 'pull_request',
    state: 'merged',
    title: 'api: allow associating multiple GitHub links with a single task',
  },
  {
    ...baseLink,
    id: 'link-3',
    number: 441,
    kind: 'pull_request',
    state: 'open',
    title: 'web: show every linked GitHub issue and PR in a section',
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SectionStory({ githubLinks }: { githubLinks: GithubLink[] }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskGithubLinksSection taskId={taskId} githubLinks={githubLinks} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/GithubLinksSection',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const Empty: SectionStoryType = {
  args: { githubLinks: [] },
}

export const SingleLink: SectionStoryType = {
  args: { githubLinks: [baseLink] },
}

export const MixedIssueAndPullRequests: SectionStoryType = {
  args: { githubLinks: mixedLinks },
}
