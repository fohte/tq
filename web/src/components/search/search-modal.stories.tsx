import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

import { SearchModal } from '#components/search/search-modal'
import { makeTask } from '#components/task/task-row-test-fixtures'
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

const mockTasks = [
  makeTask({
    id: 'task-1',
    title: 'Implement task list UI',
    estimatedMinutes: 120,
  }),
  makeTask({
    id: 'task-2',
    number: 2,
    title: 'Review pull request',
    status: 'todo',
    context: 'work',
    estimatedMinutes: 30,
  }),
]

// Renders actual result rows (unlike Default, which never types a query) so
// the selected row's highlight is captured by VRT.
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
    await expect(options[0]).toHaveClass('bg-accent')
  },
}
