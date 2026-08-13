import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { LinkExistingProjectTaskDialog } from '#components/project/link-existing-project-task-dialog'
import type { SearchResult } from '#hooks/use-search'

const candidate: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 34,
  title: 'Deploy docs site',
  description: null,
  status: 'todo',
  context: 'work',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: '00000000-0000-0000-0000-000000000099',
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const meta = {
  title: 'Project/LinkExistingProjectTaskDialog',
  component: LinkExistingProjectTaskDialog,
  args: {
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof LinkExistingProjectTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    candidate,
    currentProjectTitle: 'Website Redesign',
    projectTitle: 'ISUCON14',
    open: true,
  },
}

export const UnknownCurrentProject: Story = {
  args: {
    candidate,
    currentProjectTitle: undefined,
    projectTitle: 'ISUCON14',
    open: true,
  },
}
