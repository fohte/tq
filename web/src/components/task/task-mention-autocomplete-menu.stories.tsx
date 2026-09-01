import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, waitFor } from 'storybook/test'

import { TaskMentionAutocompleteMenu } from '#components/task/task-mention-autocomplete-menu'
import {
  type MentionSuggestion,
  taskMentionKeys,
} from '#hooks/use-task-mentions'
import { createMentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'

const sampleItems: MentionSuggestion[] = [
  { id: '1', number: 12, title: 'Deploy to production', status: 'todo' },
  { id: '2', number: 120, title: 'Deploy docs site', status: 'todo' },
  { id: '3', number: 123, title: 'Deprecate old API', status: 'completed' },
]

function TaskMentionAutocompleteMenuDemo({
  query,
  items,
  highlightedIndex = 0,
  onSelect,
}: {
  query: string
  // Omitted (rather than `[]`) lets the query actually hit the network, for
  // stories that exercise the fetch itself (e.g. `FetchFailure`) instead of
  // pre-seeding the cache.
  items?: MentionSuggestion[]
  highlightedIndex?: number
  onSelect: (item: MentionSuggestion) => void
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  const store = createMentionAutocompleteStore()
  store.show(query, { from: 0, to: 0 })
  if (items != null) {
    queryClient.setQueryData(taskMentionKeys.suggestions(query), items)
    store.setItems(items)
  }
  store.setHighlightedIndex(highlightedIndex)

  return (
    <QueryClientProvider client={queryClient}>
      <TaskMentionAutocompleteMenu store={store} onSelect={onSelect} />
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/TaskMentionAutocompleteMenu',
  component: TaskMentionAutocompleteMenuDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onSelect: fn(),
  },
} satisfies Meta<typeof TaskMentionAutocompleteMenuDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Results: Story = {
  args: {
    query: '12',
    items: sampleItems,
  },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText('Deploy to production')).toBeVisible(),
    )
  },
}

export const SecondItemHighlighted: Story = {
  args: {
    query: '12',
    items: sampleItems,
    highlightedIndex: 1,
  },
}

export const NoResults: Story = {
  args: {
    query: 'zzz',
    items: [],
  },
}

// A 5xx from the suggestions endpoint must not crash the menu into an error
// boundary — it should just show no results, like `NoResults` above.
export const FetchFailure: Story = {
  args: {
    query: '12',
  },
  parameters: {
    // Resolves to the same empty-list markup NoResults renders directly via
    // `items: []` — the play only proves the failed fetch settles on zero
    // results, not a distinct look.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/tasks/mentions', () =>
          HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
          ),
        ),
      ],
    },
  },
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText('No matching tasks')).toBeVisible(),
    )
  },
}
