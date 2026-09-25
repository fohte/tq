import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'

import { makeLabel } from '#components/label/label-test-fixtures'
import { TagsInput } from '#components/task/tags-input'
import { labelKeys } from '#hooks/use-labels'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const suggestionsQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
suggestionsQueryClient.setQueryData(labelKeys.list({ context: 'personal' }), [
  makeLabel({ id: '1', name: 'urgent' }),
  makeLabel({ id: '2', name: 'dev/tq' }),
  makeLabel({ id: '3', name: 'dev/infra' }),
])

const attachedAncestorQueryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
})
attachedAncestorQueryClient.setQueryData(
  labelKeys.list({ context: 'personal' }),
  [makeLabel({ id: '1', name: 'dev' }), makeLabel({ id: '2', name: 'dev/tq' })],
)

function TagsInputHarness({
  initialLabels,
  defaultIsAdding,
  defaultInput,
}: {
  initialLabels: string[]
  defaultIsAdding?: boolean
  defaultInput?: string
}) {
  const [labels, setLabels] = useState(initialLabels)
  return (
    <TagsInput
      labels={labels}
      onLabelsChange={setLabels}
      defaultIsAdding={defaultIsAdding ?? false}
      defaultInput={defaultInput ?? ''}
    />
  )
}

const meta = {
  title: 'Task/TagsInput',
  component: TagsInputHarness,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [http.get('/api/labels', () => HttpResponse.json([]))],
    },
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={queryClient}>
        <div className="dark w-48 bg-background p-4">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof TagsInputHarness>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  name: 'the task has no labels attached',
  args: {
    initialLabels: [],
  },
}

export const WithTags: Story = {
  name: 'the task has two labels attached',
  args: {
    initialLabels: ['dev:tq', 'chore'],
  },
}

export const AddingTag: Story = {
  name: 'the input is ready to add another label',
  args: {
    initialLabels: ['dev:tq'],
    defaultIsAdding: true,
  },
}

export const GroupsSuggestionsHierarchically: Story = {
  name: 'label suggestions are grouped by their hierarchy',
  args: {
    initialLabels: [],
    defaultIsAdding: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={suggestionsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}

export const HidesSuggestionAlreadyAttachedAsAncestor: Story = {
  name: 'an attached parent label is excluded from suggestions while its child remains available',
  args: {
    initialLabels: ['dev'],
    defaultIsAdding: true,
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={attachedAncestorQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
}
