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
        <div className="w-full max-w-3xl">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof GithubSyncRuleRow>

export default meta
type Story = StoryObj<typeof meta>

export const ScopeAllEnabled: Story = {
  name: 'an enabled sync rule applies to all projects',
  args: {
    rule: { ...baseRule },
    projects: sampleProjects,
  },
}

export const ScopeOrgEnabled: Story = {
  name: 'an enabled sync rule applies to one GitHub organization',
  args: {
    rule: { ...baseRule, scope: 'org', org: 'fohte' },
    projects: sampleProjects,
  },
}

export const ScopeRepoEnabled: Story = {
  name: 'an enabled sync rule applies to one GitHub repository',
  args: {
    rule: { ...baseRule, scope: 'repo', org: 'fohte', repo: 'tq' },
    projects: sampleProjects,
  },
}

export const ScopeAllDisabled: Story = {
  name: 'a disabled sync rule for all projects appears inactive',
  args: {
    rule: { ...baseRule, enabled: false },
    projects: sampleProjects,
  },
}

export const ScopeOrgDisabled: Story = {
  name: 'a disabled organization sync rule appears inactive',
  args: {
    rule: { ...baseRule, scope: 'org', org: 'fohte', enabled: false },
    projects: sampleProjects,
  },
}

export const ScopeRepoDisabled: Story = {
  name: 'a disabled repository sync rule appears inactive',
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
  name: 'a sync rule points to a project that cannot be found',
  args: {
    rule: { ...baseRule, targetProjectId: 'missing-project' },
    projects: sampleProjects,
  },
}
