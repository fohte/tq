import type { Meta, StoryObj } from '@storybook/react-vite'

import { LinkExistingTaskMenuAppearance } from '#components/task/link-existing-task-menu'
import { makeTask } from '#components/task/task-row-test-fixtures'
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
  title: 'Task/LinkExistingTaskMenuAppearance',
  component: LinkExistingTaskMenuAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    query: 'Deploy',
    onQueryChange: () => {},
    candidates: [orphanCandidate, candidateWithParent],
    isFetching: false,
    onSelectCandidate: () => {},
    confirmCandidate: null,
    parentTaskNumber: 1,
    onConfirmDialogOpenChange: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof LinkExistingTaskMenuAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WithCandidates: Story = {}

export const ConfirmDialog: Story = {
  args: {
    confirmCandidate: candidateWithParent,
  },
}
