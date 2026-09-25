import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'

import { makeLabel } from '#components/label/label-test-fixtures'
import { makeMentionSuggestion } from '#components/task/task-mention-test-fixtures'
import { TaskTitleInput } from '#components/task/task-title-input'
import { labelKeys } from '#hooks/use-labels'
import type { MentionSuggestion } from '#hooks/use-task-mentions'
import { taskMentionKeys } from '#hooks/use-task-mentions'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const labelsQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
labelsQueryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
  makeLabel({ id: '1', name: 'urgent' }),
  makeLabel({ id: '2', name: 'urgent-work' }),
])

const parentSuggestions: MentionSuggestion[] = [
  makeMentionSuggestion(),
  makeMentionSuggestion({ id: '2', number: 34, title: 'Fix login bug' }),
]

// Seeds useTaskMentionSuggestions's cache directly (rather than relying on
// the msw handler below) so the suggestion menu is already open on first
// render — useDebounce's initial value equals its input, so the query key
// for an empty partial is known up front.
const parentSuggestionsQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
parentSuggestionsQueryClient.setQueryData(
  taskMentionKeys.suggestions(''),
  parentSuggestions,
)

function TaskTitleInputHarness({
  initialValue,
  detectInitialTrigger,
}: {
  initialValue: string
  detectInitialTrigger?: boolean
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <TaskTitleInput
      value={value}
      onChange={setValue}
      detectInitialTrigger={detectInitialTrigger ?? false}
    />
  )
}

const meta = {
  title: 'Task/TaskTitleInput',
  component: TaskTitleInputHarness,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [
        http.get('/api/labels', () => HttpResponse.json([])),
        http.get('/api/tasks/mentions', () =>
          HttpResponse.json(parentSuggestions),
        ),
      ],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark w-64 bg-background p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof TaskTitleInputHarness>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the title field is ready for a task name',
  args: {
    initialValue: '',
  },
}

export const ShowsEstimateSuggestionsOnAt: Story = {
  name: 'typing an at sign opens estimate suggestions',
  args: {
    initialValue: 'Buy milk @',
    detectInitialTrigger: true,
  },
}

export const FiltersSuggestionsByPartialText: Story = {
  name: 'the estimate menu narrows results to the typed text',
  args: {
    initialValue: 'Buy milk @tom',
    detectInitialTrigger: true,
  },
}

export const ShowsContextSuggestionsOnPercent: Story = {
  name: 'typing a percent sign opens context suggestions',
  args: {
    initialValue: 'Buy milk %w',
    detectInitialTrigger: true,
  },
}

export const ShowsLabelSuggestionsOnHash: Story = {
  name: 'typing a hash and label prefix filters label suggestions',
  args: {
    initialValue: 'Buy milk #urg',
    detectInitialTrigger: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={labelsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const ShowsParentSuggestionsOnCaret: Story = {
  name: 'typing a caret opens parent-task suggestions',
  args: {
    initialValue: 'Buy milk ^',
    detectInitialTrigger: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={parentSuggestionsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
