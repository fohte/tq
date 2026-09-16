import type { Meta, StoryObj } from '@storybook/react-vite'

import { LinkExistingProjectTaskMenuAppearance } from '#components/project/link-existing-project-task-menu'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { SearchResult } from '#hooks/use-search'

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
  context: 'work',
})

const candidateWithProject: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  context: 'work',
  projectId: '00000000-0000-0000-0000-000000000099',
})

const meta = {
  title: 'Project/LinkExistingProjectTaskMenuAppearance',
  component: LinkExistingProjectTaskMenuAppearance,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: () => {},
    query: 'Deploy',
    onQueryChange: () => {},
    candidates: [orphanCandidate, candidateWithProject],
    isFetching: false,
    onSelectCandidate: () => {},
    confirmCandidate: null,
    currentProjectTitle: undefined,
    projectTitle: 'ISUCON14',
    onConfirmDialogOpenChange: () => {},
    onConfirm: () => {},
  },
} satisfies Meta<typeof LinkExistingProjectTaskMenuAppearance>

export default meta
type Story = StoryObj<typeof meta>

export const WithCandidates: Story = {}

export const ConfirmDialog: Story = {
  args: {
    confirmCandidate: candidateWithProject,
    currentProjectTitle: 'Website Redesign',
  },
}
