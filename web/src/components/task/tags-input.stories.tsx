import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { expect } from 'storybook/test'

import { TagsInput } from '#components/task/tags-input'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

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

export const RemovesTagOnClick: Story = {
  args: {
    initialLabels: ['urgent'],
  },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Remove urgent' }))

    await expect(canvas.queryByText('urgent')).not.toBeInTheDocument()
  },
}
