import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, within } from 'storybook/test'

import { MoveUnderTaskMenu } from '#components/task/move-under-task-menu'
import { searchKeys, type SearchResult } from '#hooks/use-search'
import { taskKeys } from '#hooks/use-tasks'

const taskId = '00000000-0000-0000-0000-000000000001'
const taskNumber = 1
const searchText = 'Deploy'

const orphanCandidate: SearchResult = {
  id: '00000000-0000-0000-0000-000000000011',
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
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const candidateWithParent: SearchResult = {
  ...orphanCandidate,
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
}

// A fresh QueryClient per story (rather than a shared module-level one) so
// seeded search/task-list data doesn't leak across stories in the same run.
function createSeededQueryClient(candidates: SearchResult[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(searchKeys.results(searchText), candidates)
  client.setQueryData(taskKeys.list(undefined), candidates)
  return client
}

const meta = {
  title: 'Task/MoveUnderTaskMenu',
  component: MoveUnderTaskMenu,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    taskId,
    taskNumber,
  },
} satisfies Meta<typeof MoveUnderTaskMenu>

export default meta
type Story = StoryObj<typeof meta>

export const WithCandidates: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([orphanCandidate, candidateWithParent])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    await expect(
      await body.findByText(`Move #${String(taskNumber)} under`),
    ).toBeInTheDocument()

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText('Deploy to production'),
    ).toBeInTheDocument()
    await expect(body.getByText('Deploy docs site')).toBeInTheDocument()
    await expect(body.getByText('← #3')).toBeInTheDocument()
  },
}

export const NoResults: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededQueryClient([])}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText(`no results for "${searchText}"`),
    ).toBeInTheDocument()
  },
}

export const Closed: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededQueryClient([])}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    open: false,
  },
}
