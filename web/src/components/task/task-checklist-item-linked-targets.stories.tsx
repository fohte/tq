import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import { makeGithubLink } from '#components/task/github-link-test-fixtures'
import { TaskChecklistItemLinkedTargets } from '#components/task/task-checklist-item-linked-targets'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { StoryRouter } from '#storybook-config/story-router'

const linkedPullRequest = makeGithubLink({
  id: 'link-linked-pr',
  owner: 'example-org',
  repo: 'sample-app',
  number: 14,
  kind: 'pull_request',
  url: 'https://github.com/example-org/sample-app/pull/14',
  state: 'merged',
})

const promotedSubtask = makeTask({
  id: '50000000-0000-4000-8000-000000000204',
  number: 27,
  title: 'Add retry handling',
})

function Providers({ children }: { children: ReactNode }) {
  return (
    <StoryRouter component={() => <>{children}</>} paths={['/tasks/$taskId']} />
  )
}

function LinkedTargetsStory({
  githubLink,
  subtask,
}: {
  githubLink?: typeof linkedPullRequest | undefined
  subtask?: typeof promotedSubtask | undefined
}) {
  return (
    <Providers>
      <div className="max-w-sm p-4">
        <TaskChecklistItemLinkedTargets
          githubLink={githubLink}
          subtask={subtask}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Checklists/ItemLinkedTargets',
  component: LinkedTargetsStory,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof LinkedTargetsStory>

export default meta
type Story = StoryObj<typeof meta>

export const PullRequest: Story = {
  name: 'a pull request chip shows its merged state',
  args: { githubLink: linkedPullRequest },
}

export const Subtask: Story = {
  name: 'a subtask chip links to its task',
  args: { subtask: promotedSubtask },
}
