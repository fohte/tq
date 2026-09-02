import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskGithubLinksSection } from '#components/task/task-github-links-section'
import type { GithubLink } from '#hooks/use-github-link'
import { StoryRouter } from '#storybook-config/story-router'

const taskId = '00000000-0000-0000-0000-000000000001'

const baseLink: GithubLink = makeGithubLink({
  number: 412,
  url: 'https://github.com/fohte/tq/issues/412',
  title: 'Support associating multiple GitHub links with a task',
})

const mixedLinks: GithubLink[] = [
  baseLink,
  makeGithubLink({
    id: 'link-2',
    number: 436,
    kind: 'pull_request',
    url: 'https://github.com/fohte/tq/issues/412',
    state: 'merged',
    title: 'api: allow associating multiple GitHub links with a single task',
  }),
  makeGithubLink({
    id: 'link-3',
    number: 441,
    kind: 'pull_request',
    url: 'https://github.com/fohte/tq/issues/412',
    state: 'open',
    title: 'web: show every linked GitHub issue and PR in a section',
  }),
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
