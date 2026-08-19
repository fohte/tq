import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TaskListColumnHeader } from '#components/task/task-list-column-header'
import { TreeTaskGridRow } from '#components/task/tree-task-grid-row'
import type { TreeNode } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTreeNode: TreeNode = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: ['dev:tq'],
  startDate: null,
  dueDate: '2099-06-15',
  estimatedMinutes: 60,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  children: [],
  childCompletionCount: { completed: 0, total: 0 },
}

// Renders the header stacked above a row that shares the same
// --task-row-columns grid template, so a VRT screenshot catches drift if
// either side's column definition changes independently of the other.
function TaskListColumnHeaderWithRow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <StoryRouter
      component={() => (
        <QueryClientProvider client={queryClient}>
          <div className="w-3xl">
            <TaskListColumnHeader />
            <TreeTaskGridRow
              node={baseTreeNode}
              isExpanded={() => true}
              onToggleExpand={() => {}}
              selectedRowId={null}
              onSelectRow={() => {}}
              outlinerInput={null}
              outlinerTarget={null}
              onOpenChildInput={() => {}}
              onCloseOutlinerInput={() => {}}
              onIndentOutlinerInput={() => {}}
              onOutdentOutlinerInput={() => {}}
            />
          </div>
        </QueryClientProvider>
      )}
      paths={['/tasks/$taskId']}
    />
  )
}

const meta = {
  title: 'Task/TaskListColumnHeader',
  component: TaskListColumnHeader,
  tags: ['desktop-only'],
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskListColumnHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-3xl">
      <TaskListColumnHeader />
    </div>
  ),
}

export const WithRow: Story = {
  render: () => <TaskListColumnHeaderWithRow />,
}
