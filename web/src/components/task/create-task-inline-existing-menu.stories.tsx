import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps } from 'react'
import { useRef } from 'react'
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

function CreateTaskInlineExistingMenuDemo(
  props: Omit<ComponentProps<typeof CreateTaskInlineExistingMenu>, 'anchor'>,
) {
  const anchorRef = useRef<HTMLInputElement>(null)

  return (
    <div className="w-72">
      <input
        ref={anchorRef}
        type="text"
        defaultValue={props.title}
        className="w-full rounded-md border border-input px-2 py-1 text-sm"
      />
      <CreateTaskInlineExistingMenu {...props} anchor={anchorRef} />
    </div>
  )
}

const meta = {
  title: 'Task/CreateTaskInlineExistingMenu',
  component: CreateTaskInlineExistingMenuDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    onSelectCandidate: fn(),
  },
} satisfies Meta<typeof CreateTaskInlineExistingMenuDemo>

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
