import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useRef } from 'react'
import { fn } from 'storybook/test'

import { CreateTaskInlineParentMenu } from '#components/task/create-task-inline-parent-menu'
import type { SearchResult } from '#hooks/use-search'

const baseCandidate: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 12,
  title: 'Deploy to production',
  description: null,
  status: 'todo',
  statusReason: null,
  duplicateOfNumber: null,
  context: 'work',
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
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

function CreateTaskInlineParentMenuDemo(
  props: Omit<ComponentProps<typeof CreateTaskInlineParentMenu>, 'anchor'>,
) {
  const anchorRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-72">
      <input
        ref={anchorRef}
        type="text"
        defaultValue="^"
        className="w-full rounded-md border border-input px-2 py-1 text-sm"
      />
      <CreateTaskInlineParentMenu {...props} anchor={anchorRef} />
    </div>
  )
}

const meta = {
  title: 'Task/CreateTaskInlineParentMenu',
  component: CreateTaskInlineParentMenuDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onSelectCandidate: fn(),
  },
} satisfies Meta<typeof CreateTaskInlineParentMenuDemo>

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
