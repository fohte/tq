import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { CreateTaskInlineParentMenu } from '#components/task/create-task-inline-parent-menu'
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
  recurrenceRule: null,
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
  title: 'Task/CreateTaskInlineParentMenu',
  component: CreateTaskInlineParentMenu,
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
} satisfies Meta<typeof CreateTaskInlineParentMenu>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: {
    candidates: [],
    highlightedIndex: 0,
    isLoading: true,
  },
}

export const Empty: Story = {
  args: {
    candidates: [],
    highlightedIndex: 0,
    isLoading: false,
  },
}

export const WithCandidates: Story = {
  args: {
    candidates,
    highlightedIndex: 0,
    isLoading: false,
  },
}

export const CandidateWithParentHighlighted: Story = {
  args: {
    candidates,
    highlightedIndex: 1,
    isLoading: false,
  },
}
