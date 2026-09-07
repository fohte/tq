import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

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

function TagsInputHarness({ initialLabels }: { initialLabels: string[] }) {
  const [labels, setLabels] = useState(initialLabels)
  return <TagsInput labels={labels} onLabelsChange={setLabels} />
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
  args: {
    initialLabels: [],
  },
}

export const WithTags: Story = {
  args: {
    initialLabels: ['dev:tq', 'chore'],
  },
}

export const OpensInputOnAddClick: Story = {
  args: {
    initialLabels: ['dev:tq'],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ add tag' }))

    await expect(canvas.getByPlaceholderText('tag name')).toBeInTheDocument()
  },
}

export const AddsNewTagOnEnter: Story = {
  args: {
    initialLabels: [],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ add tag' }))
    await userEvent.type(canvas.getByPlaceholderText('tag name'), 'urgent')
    await userEvent.keyboard('{Enter}')

    await expect(canvas.getByText('urgent')).toBeInTheDocument()
  },
}

export const ShowsSuggestionsWithoutLosingFocus: Story = {
  args: {
    initialLabels: [],
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={suggestionsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ add tag' }))
    const input = canvas.getByPlaceholderText('tag name')
    await userEvent.type(input, 'urg')

    // AnchoredPopup renders the suggestion list through a portal into
    // document.body, so it isn't inside canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('#urgent')).toBeVisible()
    await expect(input).toHaveFocus()
  },
}

export const GroupsSuggestionsHierarchically: Story = {
  args: {
    initialLabels: [],
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={suggestionsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ add tag' }))

    // AnchoredPopup renders the suggestion list through a portal into
    // document.body, so it isn't inside canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('#dev')).toBeVisible()
    await expect(body.getByText('#infra')).toBeVisible()
    await expect(body.getByText('#tq')).toBeVisible()

    await userEvent.click(body.getByText('#tq'))

    await expect(canvas.getByText('dev/tq')).toBeInTheDocument()
  },
}

export const HidesSuggestionAlreadyAttachedAsAncestor: Story = {
  args: {
    initialLabels: ['dev'],
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={attachedAncestorQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: '+ add tag' }))

    // AnchoredPopup renders the suggestion list through a portal into
    // document.body, so it isn't inside canvasElement.
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('#tq')).toBeVisible()
    await expect(body.queryByText('#dev')).not.toBeInTheDocument()
  },
}

export const RemovesTagOnClick: Story = {
  args: {
    initialLabels: ['urgent'],
  },
  parameters: {
    // Removing the only tag leaves an empty tag list, identical to Empty.
    screenshot: { skip: true },
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remove urgent' }))

    await expect(canvas.queryByText('urgent')).not.toBeInTheDocument()
  },
}
