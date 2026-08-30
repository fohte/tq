import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn, userEvent, waitFor, within } from 'storybook/test'

import { RenameSavedViewDialog } from '#components/saved-view/rename-saved-view-dialog'
import type { SavedView } from '#hooks/use-saved-views'

const view: SavedView = {
  id: '00000000-0000-0000-0000-000000000201',
  name: 'Now',
  query: 'is:todo is:in_progress sort:updated',
  position: 0,
  context: 'personal',
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const meta = {
  title: 'SavedView/RenameSavedViewDialog',
  component: RenameSavedViewDialog,
  parameters: {
    layout: 'centered',
  },
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
    view,
    open: true,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof RenameSavedViewDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    await expect(await body.findByDisplayValue('Now')).toBeInTheDocument()
  },
}

export const EmptyNameDisablesSave: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByDisplayValue('Now')
    await userEvent.clear(input)

    await expect(body.getByRole('button', { name: 'Save' })).toBeDisabled()
  },
}

export const RenameAndSubmit: Story = {
  parameters: {
    msw: {
      handlers: [
        http.patch('/api/saved-views/:id', () =>
          HttpResponse.json({ ...view, name: 'Later' }),
        ),
      ],
    },
    // The dialog itself stays mounted throughout (`open` is a static arg
    // here, so `onOpenChange` never actually closes it) — Default already
    // covers the open dialog's appearance, so skipping this capture doesn't
    // drop coverage.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement, args }) => {
    const body = within(canvasElement.ownerDocument.body)
    const input = await body.findByDisplayValue('Now')
    await userEvent.clear(input)
    await userEvent.type(input, 'Later')
    await userEvent.click(await body.findByRole('button', { name: 'Save' }))

    await waitFor(async () => {
      await expect(args.onOpenChange).toHaveBeenCalledWith(false)
    })
  },
}
