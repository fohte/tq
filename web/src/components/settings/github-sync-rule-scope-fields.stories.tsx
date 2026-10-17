import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { GithubSyncRuleScopeFields } from '#components/settings/github-sync-rule-scope-fields'

const meta = {
  title: 'Settings/GithubSyncRuleScopeFields',
  component: GithubSyncRuleScopeFields,
  decorators: [
    (Story) => (
      <div className="dark w-full max-w-96 bg-background p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    onOrgChange: fn(),
    onRepoChange: fn(),
  },
} satisfies Meta<typeof GithubSyncRuleScopeFields>

export default meta
type Story = StoryObj<typeof meta>

export const OrganizationScope: Story = {
  name: 'the organization scope shows an editable organization field',
  args: {
    scope: 'org',
    org: 'example-org',
    repo: '',
  },
}

export const RepositoryScope: Story = {
  name: 'the repository scope shows editable organization and repository fields',
  args: {
    scope: 'repo',
    org: 'example-org',
    repo: 'example-repo',
  },
}
