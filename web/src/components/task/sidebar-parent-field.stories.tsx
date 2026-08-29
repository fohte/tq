import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, waitFor, within } from 'storybook/test'

import { SidebarParentField } from '#components/task/sidebar-parent-field'
import { DetailSidebarPanel } from '#components/ui/detail-sidebar-panel'
import { searchKeys, type SearchResult } from '#hooks/use-search'
import { taskKeys } from '#hooks/use-tasks'

const currentTask: SearchResult = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 10,
  title: 'Current task',
  description: null,
  status: 'todo',
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
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const existingParentTask: SearchResult = {
  ...currentTask,
  id: '00000000-0000-0000-0000-000000000002',
  number: 5,
  title: 'Existing parent',
}

const childTask: SearchResult = {
  ...currentTask,
  id: '00000000-0000-0000-0000-000000000003',
  number: 11,
  title: 'Child of current task',
  parentId: currentTask.id,
  parentNumber: currentTask.number,
}

const searchCandidate: SearchResult = {
  ...currentTask,
  id: '00000000-0000-0000-0000-000000000004',
  number: 20,
  title: 'Deploy to production',
}

const allTasks = [currentTask, existingParentTask, childTask]

function createSeededQueryClient(searchResults: {
  query: string
  results: SearchResult[]
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
  client.setQueryData(taskKeys.list(undefined), allTasks)
  client.setQueryData(
    searchKeys.results(searchResults.query),
    searchResults.results,
  )
  return client
}

const meta = {
  title: 'Task/TaskDetail/SidebarParentField',
  component: SidebarParentField,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div className="flex h-64">
        <DetailSidebarPanel>
          <Story />
        </DetailSidebarPanel>
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarParentField>

export default meta
type Story = StoryObj<typeof meta>

export const NoParent: Story = {
  args: {
    taskId: currentTask.id,
    parentId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient({ query: '', results: [] })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const WithParent: Story = {
  args: {
    taskId: currentTask.id,
    parentId: existingParentTask.id,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient({ query: '', results: [] })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const Editing: Story = {
  args: {
    taskId: currentTask.id,
    parentId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient({ query: '', results: [] })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('—'))
    await canvas.findByPlaceholderText('Search tasks...')
    await body.findByText('Type to search...')
  },
}

const searchText = 'Deploy'

export const SearchAndSelect: Story = {
  args: {
    taskId: currentTask.id,
    parentId: null,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient({
          query: searchText,
          results: [searchCandidate],
        })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    // currentParent is derived from the `parentId` prop, which this story
    // never updates after selecting — the row still reads null, identical
    // to NoParent's closed state.
    screenshot: { skip: true },
    // updateParent's onSettled invalidates taskKeys.all, which
    // invalidateQueries refetches regardless of staleTime — a real GET
    // response is required alongside the PATCH.
    msw: {
      handlers: [
        http.patch('/api/tasks/:id/parent', () => HttpResponse.json({})),
        http.get('/api/tasks', () => HttpResponse.json(allTasks)),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('—'))
    const input = canvas.getByPlaceholderText('Search tasks...')
    await userEvent.type(input, searchText)

    const candidateRow = await body.findByText('Deploy to production')

    // The current task and its own child are excluded from candidates.
    await expect({
      currentTaskShown: body.queryByText('Current task') != null,
      childTaskShown: body.queryByText('Child of current task') != null,
    }).toEqual({
      currentTaskShown: false,
      childTaskShown: false,
    })

    await userEvent.click(candidateRow)

    await waitFor(() =>
      expect(canvas.queryByPlaceholderText('Search tasks...')).toBeNull(),
    )
  },
}

export const ClearParent: Story = {
  args: {
    taskId: currentTask.id,
    parentId: existingParentTask.id,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={createSeededQueryClient({ query: '', results: [] })}
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  parameters: {
    // currentParent is derived from the `parentId` prop, which this story
    // never updates after clearing — the row still reads the original
    // parent id, identical to WithParent's closed state.
    screenshot: { skip: true },
    // updateParent's onSettled invalidates taskKeys.all, which
    // invalidateQueries refetches regardless of staleTime — a real GET
    // response is required alongside the PATCH.
    msw: {
      handlers: [
        http.patch('/api/tasks/:id/parent', () => HttpResponse.json({})),
        http.get('/api/tasks', () => HttpResponse.json(allTasks)),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(canvas.getByText('#5 Existing parent'))
    const clearRow = await body.findByText('—')
    await userEvent.click(clearRow)

    await waitFor(() =>
      expect(canvas.queryByPlaceholderText('Search tasks...')).toBeNull(),
    )
  },
}
