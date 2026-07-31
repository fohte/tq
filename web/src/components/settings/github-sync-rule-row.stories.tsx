import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { GithubSyncRuleRow } from '#components/settings/github-sync-rule-row'
import type { SyncRule } from '#hooks/use-github-sync-rules'
import type { Project } from '#hooks/use-projects'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

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
  },
]

const baseRule: SyncRule = {
  id: 'rule-1',
  scope: 'all',
  org: null,
  repo: null,
  trigger: 'assigned',
  targetProjectId: 'project-1',
  enabled: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const meta = {
  title: 'Settings/GithubSyncRuleRow',
  component: GithubSyncRuleRow,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-[560px]">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof GithubSyncRuleRow>

export default meta
type Story = StoryObj<typeof meta>

export const ScopeAllEnabled: Story = {
  args: {
    rule: { ...baseRule },
    projects: sampleProjects,
  },
}

export const ScopeOrgEnabled: Story = {
  args: {
    rule: { ...baseRule, scope: 'org', org: 'fohte' },
    projects: sampleProjects,
  },
}

export const ScopeRepoEnabled: Story = {
  args: {
    rule: { ...baseRule, scope: 'repo', org: 'fohte', repo: 'tq' },
    projects: sampleProjects,
  },
}

export const ScopeAllDisabled: Story = {
  args: {
    rule: { ...baseRule, enabled: false },
    projects: sampleProjects,
  },
}

export const ScopeOrgDisabled: Story = {
  args: {
    rule: { ...baseRule, scope: 'org', org: 'fohte', enabled: false },
    projects: sampleProjects,
  },
}

export const ScopeRepoDisabled: Story = {
  args: {
    rule: {
      ...baseRule,
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      enabled: false,
    },
    projects: sampleProjects,
  },
}

export const UnknownProject: Story = {
  args: {
    rule: { ...baseRule, targetProjectId: 'missing-project' },
    projects: sampleProjects,
  },
}
