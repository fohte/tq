import type { Meta, StoryObj } from '@storybook/react-vite'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { SidebarGithubLinkField } from '#components/task/task-github-link-field'
import type { GithubLink } from '#hooks/use-github-link'

const sampleLink: GithubLink = makeGithubLink()

const meta = {
  title: 'Task/SidebarGithubLinkField',
  component: SidebarGithubLinkField,
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
} satisfies Meta<typeof SidebarGithubLinkField>

export default meta
type Story = StoryObj<typeof meta>

export const Unlinked: Story = {
  name: 'the field has no GitHub links attached',
  args: {
    githubLinks: [],
  },
}

export const SingleLink: Story = {
  name: 'the field shows one GitHub link',
  args: {
    githubLinks: [sampleLink],
  },
}

export const MultipleLinks: Story = {
  name: 'the field shows several GitHub links',
  args: {
    githubLinks: [
      sampleLink,
      { ...sampleLink, id: 'link-2', number: 43, kind: 'pull_request' },
      { ...sampleLink, id: 'link-3', number: 44, kind: 'pull_request' },
    ],
  },
}
