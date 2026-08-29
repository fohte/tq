import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, fn, within } from 'storybook/test'

import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { searchKeys, type SearchResult } from '#hooks/use-search'

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
  githubLinks: [],
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

const excludedCandidate: SearchResult = {
  ...orphanCandidate,
  id: '00000000-0000-0000-0000-000000000013',
  number: 56,
  title: 'Deploy staging environment',
}

// A fresh QueryClient per story (rather than a shared module-level one) so
// seeded search data doesn't leak across stories in the same run.
function createSeededQueryClient(candidates: SearchResult[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(searchKeys.results(searchText), candidates)
  return client
}

const meta = {
  title: 'Task/TaskSearchCandidateDialog',
  component: TaskSearchCandidateDialog,
  parameters: {
    layout: 'centered',
  },
  args: {
    open: true,
    onOpenChange: fn(),
    title: 'Link existing task',
    excludedTaskIds: new Set<string>(),
    onSelectCandidate: fn(),
  },
} satisfies Meta<typeof TaskSearchCandidateDialog>

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
  play: async ({ canvasElement, userEvent, args }) => {
    const body = within(canvasElement.ownerDocument.body)

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText('Deploy to production'),
    ).toBeInTheDocument()
    await expect(body.getByText('Deploy docs site')).toBeInTheDocument()
    await expect(body.getByText('← #3')).toBeInTheDocument()

    await userEvent.click(body.getByText('Deploy docs site'))

    await expect(args.onSelectCandidate).toHaveBeenCalledWith(
      candidateWithParent,
    )
  },
}

export const ExcludesGivenTaskIds: Story = {
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([orphanCandidate, excludedCandidate])}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    excludedTaskIds: new Set([excludedCandidate.id]),
  },
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)

    const input = await body.findByPlaceholderText(/Search tasks/i)
    await userEvent.type(input, searchText)

    await expect(
      await body.findByText('Deploy to production'),
    ).toBeInTheDocument()
    await expect(
      body.queryByText('Deploy staging environment'),
    ).not.toBeInTheDocument()
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
