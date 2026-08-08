import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CreateTaskInlineExistingMenu } from '#components/task/create-task-inline-existing-menu'
import type { SearchResult } from '#hooks/use-search'

const baseCandidate: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 12,
  title: 'Deploy to production',
  description: null,
  status: 'todo',
  context: 'work',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const candidates: SearchResult[] = [
  baseCandidate,
  {
    ...baseCandidate,
    id: '00000000-0000-0000-0000-000000000002',
    number: 34,
    title: 'Deploy docs site',
    parentId: '00000000-0000-0000-0000-000000000099',
    parentNumber: 3,
  },
]

const meta = {
  title: 'Task/CreateTaskInlineExistingMenu',
  component: CreateTaskInlineExistingMenu,
  parameters: {
    layout: 'centered',
  },
  args: {
    onSelectCandidate: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative w-72">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CreateTaskInlineExistingMenu>

export default meta
type Story = StoryObj<typeof meta>

export const CreateHighlighted: Story = {
  args: {
    title: 'Deploy',
    candidates,
    highlightedIndex: 0,
  },
}

export const CandidateHighlighted: Story = {
  args: {
    title: 'Deploy',
    candidates,
    highlightedIndex: 1,
  },
}

export const CandidateWithParentHighlighted: Story = {
  args: {
    title: 'Deploy',
    candidates,
    highlightedIndex: 2,
  },
}
