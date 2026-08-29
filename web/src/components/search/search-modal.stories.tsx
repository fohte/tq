import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

import { SearchModal } from '#components/search/search-modal'
import type { SearchResult } from '#hooks/use-search'
import { StoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function SearchModalStory() {
  const [open, setOpen] = useState(true)
  return (
    <Providers>
      <div className="flex h-screen items-center justify-center bg-background">
        <button
          type="button"
          onClick={() => {
            setOpen(true)
          }}
          className="border border-border bg-secondary px-4 py-2 font-mono text-sm text-foreground"
        >
          Open Search (Cmd+K)
        </button>
        <SearchModal open={open} onOpenChange={setOpen} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Search/SearchModal',
  component: SearchModalStory,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SearchModalStory>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

const mockTasks: SearchResult[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    title: 'Implement task list UI',
    description: null,
    status: 'todo',
    context: 'personal',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 120,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    number: 2,
    title: 'Review pull request',
    description: null,
    status: 'in_progress',
    context: 'work',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
  },
]

// Regression coverage for the bug where the keyboard-selected row's
// highlight was invisible against the panel background (both used
// --secondary). Renders actual result rows so the highlighted one is
// captured by VRT — the Default story never renders any rows.
export const ResultsWithSelectedRow: Story = {
  parameters: {
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json(mockTasks)),
        http.get('/api/tasks/search/suggest', () => HttpResponse.json([])),
      ],
    },
  },
  play: async ({ canvasElement, userEvent }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = body.getByLabelText('Search tasks')
    await userEvent.type(input, 'task')

    await expect(await body.findByText('Implement task list UI')).toBeVisible()

    const options = body.getAllByRole('option')
    await expect(options[0]).toHaveAttribute('aria-selected', 'true')
  },
}
