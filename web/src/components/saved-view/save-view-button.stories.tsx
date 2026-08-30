import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { SaveViewButton } from '#components/saved-view/save-view-button'

const meta = {
  title: 'SavedView/SaveViewButton',
  component: SaveViewButton,
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false, staleTime: Infinity } },
          })
        }
      >
        <Story />
      </QueryClientProvider>
    ),
  ],
  args: {
    query: 'is:todo is:in_progress sort:updated',
  },
} satisfies Meta<typeof SaveViewButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const DialogOpen: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save view' }))

    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByPlaceholderText('View name')).toBeVisible()
  },
}

export const Submits: Story = {
  parameters: {
    msw: {
      handlers: [
        http.post('/api/saved-views', () =>
          HttpResponse.json({
            id: '00000000-0000-0000-0000-000000000201',
            name: 'Now',
            query: 'is:todo is:in_progress sort:updated',
            position: 0,
            context: 'personal',
            createdAt: '2026-03-20T00:00:00.000Z',
            updatedAt: '2026-03-20T00:00:00.000Z',
          }),
        ),
      ],
    },
    // The dialog closes on a successful save, so this story's end state is
    // identical to Default's closed state.
    screenshot: { skip: true },
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Save view' }))

    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByPlaceholderText('View name')
    await userEvent.type(input, 'Now')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(
        body.queryByPlaceholderText('View name'),
      ).not.toBeInTheDocument()
    })
  },
}
