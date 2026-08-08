import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor, within } from 'storybook/test'

import { CreateTaskInline } from '#components/task/create-task-inline'
import { searchKeys, type SearchResult } from '#hooks/use-search'
import { taskKeys } from '#hooks/use-tasks'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const meta = {
  title: 'Task/CreateTaskInline',
  component: CreateTaskInline,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="w-80">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    onClose: fn(),
  },
} satisfies Meta<typeof CreateTaskInline>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

// --- Existing-candidates menu (subtask row only, `parentId` set) ---

const parentTaskId = '00000000-0000-0000-0000-000000000001'
const parentTaskNumber = 1
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
  sortOrder: 0,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const candidateWithParent: SearchResult = {
  ...orphanCandidate,
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  parentId: '00000000-0000-0000-0000-000000000099',
  parentNumber: 3,
}

// A fresh QueryClient per story (rather than reusing the module-level
// `queryClient`) so the seeded search/task-list data doesn't leak across
// stories that render in the same test run.
function createSeededQueryClient(candidates: SearchResult[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(searchKeys.results(searchText), candidates)
  client.setQueryData(taskKeys.list(undefined), candidates)
  return client
}

export const LinkOrphanCandidate: Story = {
  args: {
    parentId: parentTaskId,
    parentTaskNumber,
    closeOnSubmit: false,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={createSeededQueryClient([orphanCandidate])}>
        <div className="w-80">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  parameters: {
    // The row resets only once `useUpdateTaskParent`'s mutation actually
    // succeeds, so the PATCH it fires needs a real response — the body is
    // unused by the caller, only the 200 status matters.
    msw: {
      handlers: [
        http.patch('/api/tasks/:id/parent', () => HttpResponse.json({})),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByPlaceholderText(/New task/i)
    await userEvent.type(input, searchText)

    // Wait for the search query's debounce to settle before the combined
    // dropdown appears.
    const candidateRow = await canvas.findByText('Deploy to production')
    await expect(candidateRow).toBeInTheDocument()
    await expect(canvas.getByText(`Create "${searchText}"`)).toBeInTheDocument()

    // No parent hint for a candidate that has no parent yet.
    await expect(canvas.queryByText(/^←/)).not.toBeInTheDocument()

    await userEvent.click(candidateRow)

    // Linking an orphan candidate is immediate: no confirmation dialog, and
    // the row resets as if a task had just been created.
    await expect(
      canvas.queryByText(`Create "${searchText}"`),
    ).not.toBeInTheDocument()
    // The row only resets once the parent-update mutation's `onSuccess`
    // fires, which lands after the (mocked) network round trip.
    await waitFor(() => expect(input).toHaveValue(''))
  },
}

export const LinkCandidateWithExistingParent: Story = {
  args: {
    parentId: parentTaskId,
    parentTaskNumber,
    closeOnSubmit: false,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient([candidateWithParent])}
      >
        <div className="w-80">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)

    const input = canvas.getByPlaceholderText(/New task/i)
    await userEvent.type(input, searchText)

    const candidateRow = await canvas.findByText('Deploy docs site')
    await expect(canvas.getByText('← #3')).toBeInTheDocument()

    await userEvent.click(candidateRow)

    // The dialog renders via a portal, so it lives outside `canvasElement`.
    const body = within(canvasElement.ownerDocument.body)
    await expect(
      await body.findByText('Change parent task?'),
    ).toBeInTheDocument()
    await expect(
      body.getByText(
        '#34 Deploy docs site currently belongs to #3. It will be moved under #1.',
      ),
    ).toBeInTheDocument()
    await expect(body.getByRole('button', { name: 'Move' })).toBeInTheDocument()
  },
}
