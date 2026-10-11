import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makeResolveGithubUrlResult } from '#components/task/github-link-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { TaskSearchCandidateDialogAppearance } from '#components/task/task-search-candidate-dialog'
import type { SearchResult } from '#hooks/use-search'

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
  context: 'work',
})

const candidateWithParent: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  context: 'work',
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
})

const meta = {
  title: 'Task/TaskSearchCandidateDialogAppearance',
  component: TaskSearchCandidateDialogAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    title: 'Link existing task',
    query: '',
    onQueryChange: () => {},
    candidates: [],
    isFetching: false,
    onSelectCandidate: () => {},
  },
} satisfies Meta<typeof TaskSearchCandidateDialogAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the dialog invites you to search for a task',
}

export const WithCandidates: Story = {
  name: 'matching tasks appear with their parent context',
  args: {
    query: 'Deploy',
    candidates: [orphanCandidate, candidateWithParent],
  },
}

export const WithWaitAction: Story = {
  name: 'the dialog offers to wait for the entered text after task matches',
  args: {
    title: 'Add blocker',
    query: 'Review the proposal',
    candidates: [orphanCandidate],
    onSelectWait: fn(),
  },
}

export const NoResults: Story = {
  name: 'the dialog explains when no tasks match the search',
  args: {
    query: 'Deploy',
    candidates: [],
  },
}

export const WithSkipAction: Story = {
  name: 'matching tasks appear alongside an option to skip linking',
  args: {
    title: 'Duplicate of',
    query: 'Deploy',
    candidates: [orphanCandidate, candidateWithParent],
    skipAction: { label: 'Close without linking', onSkip: () => {} },
  },
}

export const WithGithubUrlCandidate: Story = {
  name: 'a pasted GitHub URL shows its pull request candidate',
  args: {
    title: 'Add blocker',
    allowGithubUrls: true,
    query: 'https://github.com/example-team/sample-project/pull/2048',
    githubCandidate: makeResolveGithubUrlResult({
      owner: 'example-team',
      repo: 'sample-project',
      number: 2048,
      kind: 'pull_request',
      url: 'https://github.com/example-team/sample-project/pull/2048',
      title: 'Update the build tools',
    }).preview,
  },
}

export const ResolvingGithubUrl: Story = {
  name: 'the dialog indicates that GitHub details are loading',
  args: {
    title: 'Add blocker',
    allowGithubUrls: true,
    query: 'https://github.com/example-team/sample-project/pull/2048',
    isResolvingGithubUrl: true,
  },
}

export const GithubUrlError: Story = {
  name: 'the dialog explains why a GitHub URL could not be resolved',
  args: {
    title: 'Add blocker',
    allowGithubUrls: true,
    query: 'https://github.com/example-team/sample-project/pull/2048',
    githubUrlError: 'GitHub is not connected.',
  },
}
