import type { Meta, StoryObj } from '@storybook/react-vite'

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
