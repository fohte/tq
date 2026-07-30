import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fn } from 'storybook/test'

import { TaskMentionAutocompleteMenu } from '#components/task/task-mention-autocomplete-menu'
import {
  type MentionSuggestion,
  taskMentionKeys,
} from '#hooks/use-task-mentions'
import { createMentionAutocompleteStore } from '#lib/inline-reference/providers/task-mention-autocomplete-store'

const sampleItems: MentionSuggestion[] = [
  { id: '1', number: 12, title: 'Deploy to production', status: 'todo' },
  { id: '2', number: 120, title: 'Deploy docs site', status: 'in_progress' },
  { id: '3', number: 123, title: 'Deprecate old API', status: 'completed' },
]

function TaskMentionAutocompleteMenuDemo({
  query,
  items,
  highlightedIndex = 0,
  onSelect,
}: {
  query: string
  items: MentionSuggestion[]
  highlightedIndex?: number
  onSelect: (item: MentionSuggestion) => void
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskMentionKeys.suggestions(query), items)

  const store = createMentionAutocompleteStore()
  store.show(query, { from: 0, to: 0 })
  store.setItems(items)
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
