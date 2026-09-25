import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { fn } from 'storybook/test'

import { getSearchSyntaxHelpSections } from '#components/search/search-syntax-help-data'
import { makeSuggestion } from '#components/search/search-test-fixtures'
import { TaskFilterFreeTextInput } from '#components/task/task-filter-free-text-input'
import { searchKeys } from '#hooks/use-search'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const suggestionFixtures = [
  makeSuggestion(),
  makeSuggestion({ value: 'is:completed', display: 'Completed' }),
]

const emptySuggestHandler = http.get('/api/tasks/search/suggest', () =>
  HttpResponse.json([]),
)

const meta = {
  title: 'Task/TaskFilterFreeTextInput',
  component: TaskFilterFreeTextInput,
  parameters: {
    layout: 'centered',
    msw: { handlers: [emptySuggestHandler] },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="flex w-full max-w-96 border border-border bg-background px-3 py-2">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
  args: {
    id: 'story-free-text',
    freeText: 'hello',
    onCommit: fn(),
    onBackspaceEmpty: fn(),
    syntaxHelpSections: getSearchSyntaxHelpSections({
      audience: 'task-filter',
    }),
  },
} satisfies Meta<typeof TaskFilterFreeTextInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    freeText: '',
    placeholder: 'Filter…',
  },
}

export const SyntaxHelpFocused: Story = {
  args: {
    freeText: '',
    autoFocus: true,
    placeholder: 'Filter…',
  },
}

// Pre-seeds the suggestions query cache with a `staleTime: Infinity` client
// (instead of typing through a play) so react-query never refetches over
// the fixture — `autoFocus` focuses the input, while `freeText: 'is:'` derives
// `hasSuggestions` and opens the suggestions popup.
const suggestionsQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
suggestionsQueryClient.setQueryData(
  searchKeys.suggestions('is:'),
  suggestionFixtures,
)

export const WithSuggestionsOpen: Story = {
  args: {
    freeText: 'is:',
    autoFocus: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={suggestionsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
