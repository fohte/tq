import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { useState } from 'react'
import { expect, within } from 'storybook/test'

import { makeLabel } from '#components/label/label-test-fixtures'
import { TaskTitleInput } from '#components/task/task-title-input'
import { labelKeys } from '#hooks/use-labels'

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

function TaskTitleInputHarness({ initialValue }: { initialValue: string }) {
  const [value, setValue] = useState(initialValue)
  return <TaskTitleInput value={value} onChange={setValue} />
}

const meta = {
  title: 'Task/TaskTitleInput',
  component: TaskTitleInputHarness,
  parameters: {
    layout: 'centered',
    msw: {
      handlers: [http.get('/api/labels', () => HttpResponse.json([]))],
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
  args: {
    initialValue: '',
  },
}

export const ShowsEstimateSuggestionsOnAt: Story = {
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Buy milk @')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('@today')).toBeVisible()
    await expect(body.getByText('@30m')).toBeVisible()
  },
}

export const FiltersSuggestionsByPartialText: Story = {
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Buy milk @tom')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('@tomorrow')).toBeVisible()
    await expect(body.queryByText('@30m')).not.toBeInTheDocument()
  },
}

export const SelectsSuggestionOnEnter: Story = {
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole('textbox')
    await userEvent.type(input, 'Buy milk @30')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('@30m')).toBeVisible()

    await userEvent.keyboard('{Enter}')

    await expect(input).toHaveValue('Buy milk @30m ')
    await expect(body.queryByText('@30m')).not.toBeInTheDocument()
  },
}

export const ShowsContextSuggestionsOnPercent: Story = {
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Buy milk %w')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('%work')).toBeVisible()
    await expect(body.queryByText('%personal')).not.toBeInTheDocument()
  },
}

export const ShowsLabelSuggestionsOnHash: Story = {
  args: {
    initialValue: '',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider client={labelsQueryClient}>
        <Story />
      </QueryClientProvider>
    ),
  ],
  play: async ({ canvasElement, canvas, userEvent }) => {
    await userEvent.type(canvas.getByRole('textbox'), 'Buy milk #urg')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('#urgent')).toBeVisible()
    await expect(body.getByText('#urgent-work')).toBeVisible()
  },
}

export const EscapeClosesMenuWithoutClearingText: Story = {
  args: {
    initialValue: '',
  },
  play: async ({ canvasElement, canvas, userEvent }) => {
    const input = canvas.getByRole('textbox')
    await userEvent.type(input, 'Buy milk @')

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByText('@today')).toBeVisible()

    await userEvent.keyboard('{Escape}')

    await expect(body.queryByText('@today')).not.toBeInTheDocument()
    await expect(input).toHaveValue('Buy milk @')
  },
}
