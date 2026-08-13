import type { Meta, StoryObj } from '@storybook/react-vite'

import { PageBreadcrumb } from '#components/task/page-breadcrumb'
import type { TaskPage } from '#hooks/use-task-pages'

const samplePage: TaskPage = {
  id: 'page-001',
  taskId: 'task-001',
  title: 'Meeting Notes',
  content: '## Discussion Points\n\n- Architecture review\n- Sprint planning',
  format: 'markdown',
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  author: null,
}

const meta = {
  title: 'Task/PageBreadcrumb',
  component: PageBreadcrumb,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="flex h-10 w-96 items-center gap-2.5 border-b border-border px-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PageBreadcrumb>

export default meta
type Story = StoryObj<typeof meta>

export const Loading: Story = {
  args: {
    isLoading: true,
    taskNumber: undefined,
    page: undefined,
  },
}

export const NotFound: Story = {
  args: {
    isLoading: false,
    taskNumber: undefined,
    page: undefined,
  },
}

export const Default: Story = {
  args: {
    isLoading: false,
    taskNumber: 42,
    page: samplePage,
  },
}

export const WithoutTaskNumber: Story = {
  args: {
    isLoading: false,
    taskNumber: undefined,
    page: samplePage,
  },
}
