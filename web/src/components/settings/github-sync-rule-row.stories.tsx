import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { GithubSyncRuleRow } from '#components/settings/github-sync-rule-row'
import { sampleProjects } from '#components/settings/sync-rule-test-fixtures'
import type { SyncRule } from '#hooks/use-github-sync-rules'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

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
    // The row always mounts a (closed) GithubSyncRuleFormModal for editing,
    // which queries the project list even while hidden.
    msw: {
      handlers: [
        http.get('/api/projects', () => HttpResponse.json(sampleProjects)),
      ],
    },
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
