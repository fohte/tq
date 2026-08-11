import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { delay, http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'

import { GithubSyncRuleList } from '#components/settings/github-sync-rule-list'
import type { SyncRule } from '#hooks/use-github-sync-rules'
import type { Project } from '#hooks/use-projects'

const sampleProjects: Project[] = [
  {
    id: 'project-1',
    title: 'tq',
    description: null,
    status: 'active',
    startDate: null,
    targetDate: null,
    color: '#FF8400',
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    completionRate: 0,
    taskCount: { total: 0, completed: 0 },
  },
]

const sampleRules: SyncRule[] = [
  {
    id: 'rule-1',
    scope: 'all',
    org: null,
    repo: null,
    trigger: 'assigned',
    targetProjectId: 'project-1',
    enabled: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'rule-2',
    scope: 'repo',
    org: 'fohte',
    repo: 'tq',
    trigger: 'assigned',
    targetProjectId: 'project-1',
    enabled: false,
    createdAt: '2026-01-02T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  },
]

const projectsHandler = http.get('/api/projects', () =>
  HttpResponse.json(sampleProjects),
)

function syncRulesHandler(rules: SyncRule[]) {
  return http.get('/api/github/sync-rules', () => HttpResponse.json(rules))
}

function Providers({
  children,
  syncRules,
  projects = sampleProjects,
}: {
  children: ReactNode
  syncRules?: SyncRule[] | undefined
  projects?: Project[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  if (syncRules !== undefined) {
    queryClient.setQueryData(['github-sync-rules'], syncRules)
  }
  queryClient.setQueryData(['projects', 'list', undefined], projects)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function WrappedGithubSyncRuleList(props: { syncRules?: SyncRule[] }) {
  return (
    <Providers syncRules={props.syncRules}>
      <div className="w-[600px]">
        <GithubSyncRuleList />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Settings/GithubSyncRuleList',
  component: WrappedGithubSyncRuleList,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WrappedGithubSyncRuleList>

export default meta
type Story = StoryObj<typeof meta>

// syncRules left undefined so the query never gets a cached value, keeping
// the component in its initial isLoading render. The sync-rules request is
// held open (rather than errored) so the loading state stays visible.
export const Loading: Story = {
  args: {},
  parameters: {
    msw: {
      handlers: [
        projectsHandler,
        http.get('/api/github/sync-rules', async () => {
          await delay('infinite')
          return HttpResponse.json([])
        }),
      ],
    },
  },
}

export const Empty: Story = {
  args: {
    syncRules: [],
  },
  parameters: {
    msw: {
      handlers: [projectsHandler, syncRulesHandler([])],
    },
  },
}

export const Populated: Story = {
  args: {
    syncRules: sampleRules,
  },
  parameters: {
    msw: {
      handlers: [projectsHandler, syncRulesHandler(sampleRules)],
    },
  },
}
