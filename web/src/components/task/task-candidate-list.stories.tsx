import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskCandidateList } from '#components/task/task-candidate-list'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { SearchResult } from '#hooks/use-search'

const baseCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  number: 12,
  title: 'Deploy to production',
  context: 'work',
})

const candidates: SearchResult[] = [
  baseCandidate,
  makeTask({
    id: '00000000-0000-0000-0000-000000000002',
    number: 34,
    title: 'Deploy docs site',
    context: 'work',
    parentId: '00000000-0000-0000-0000-000000000099',
    parentNumber: 3,
  }),
]

const meta = {
  title: 'Task/TaskCandidateList',
  component: TaskCandidateList,
  parameters: {
    layout: 'centered',
  },
  args: {
    onSelectCandidate: fn(),
  },
  decorators: [
    (Story) => (
      <div className="relative w-72 border border-border bg-popover py-1 font-mono">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TaskCandidateList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    candidates,
    highlightedIndex: -1,
  },
}

export const FirstHighlighted: Story = {
  args: {
    candidates,
    highlightedIndex: 0,
  },
}

export const WithIndexOffset: Story = {
  args: {
    candidates,
    highlightedIndex: 2,
    indexOffset: 1,
  },
}
