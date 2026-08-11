import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { GithubSyncRuleFormModal } from '#components/settings/github-sync-rule-form-modal'
import { sampleProjects } from '#components/settings/sync-rule-test-fixtures'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Settings/GithubSyncRuleFormModal',
  component: GithubSyncRuleFormModal,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/projects', () => HttpResponse.json(sampleProjects)),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark h-screen bg-background">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof GithubSyncRuleFormModal>

export default meta
type Story = StoryObj<typeof meta>

export const Create: Story = {}

export const Edit: Story = {
  args: {
    rule: {
      id: 'rule-1',
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      trigger: 'assigned',
      targetProjectId: 'project-1',
      enabled: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  },
}
