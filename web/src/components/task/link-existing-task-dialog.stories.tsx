import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { LinkExistingTaskDialog } from '#components/task/link-existing-task-dialog'
import type { SearchResult } from '#hooks/use-search'

const candidate: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 34,
  title: 'Deploy docs site',
  description: null,
  status: 'todo',
  context: 'work',
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const meta = {
  title: 'Task/LinkExistingTaskDialog',
  component: LinkExistingTaskDialog,
  args: {
    onOpenChange: fn(),
    onConfirm: fn(),
  },
} satisfies Meta<typeof LinkExistingTaskDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Open: Story = {
  args: {
    candidate,
    parentTaskNumber: 1,
    open: true,
  },
}
